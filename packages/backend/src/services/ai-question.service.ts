import { getCollection, MongoCollections, type AIQuestionDocument } from '../lib/mongodb';
import { prisma } from '../lib/prisma';
import logger from '../lib/logger';
import { randomUUID } from 'crypto';
import {
  aiProviderService,
  isModelAvailable,
  type AIModel,
} from './ai-provider.service';
import { TaskService } from './task.service';

export interface CreateQuestionInput { reportId: string; question: string; locale?: string; }

export class AiQuestionService {
  /**
   * Submit a follow-up question (9.1)
   * @param options.skipCreditAward When true, user already paid with credits — skip TaskService credit award
   */
  async askQuestion(userId: string, data: CreateQuestionInput, options?: { skipCreditAward?: boolean }): Promise<AIQuestionDocument> {
    const startTime = Date.now();

    // Verify report belongs to user
    const reportCollection = await getCollection(MongoCollections.AI_REPORTS);
    const report = await reportCollection.findOne({ reportId: data.reportId, userId });
    if (!report) throw new Error('Report not found');

    const locale = data.locale || 'en';
    const isZh = locale.startsWith('zh');
    const model: AIModel = (report.aiModel || 'gpt-4o') as AIModel;

    // Verify model is available
    if (!isModelAvailable(model)) {
      logger.error(`Model ${model} is not available for follow-up question`);
      throw new Error(`AI model ${model} is not configured.`);
    }

    let answer: string = '';
    let tokensUsed = 0;
    let actualModel = model;

    // Build rich context from both V1 and V2 report data
    const c = report.content as any;
    
    const v1Context = [
      `报告摘要：${c.summary}`,
      `主要统计：总交易 ${c.statistics?.totalTrades ?? '?'} 笔，胜率 ${c.statistics?.winRate ?? '?'}%，平均盈亏 $${c.statistics?.avgPnL ?? '?'}`,
      `最大回撤：$${c.statistics?.maxDrawdown ?? '?'}`,
      `最佳品种：${c.statistics?.bestPerformingSymbol ?? '-'} | 最差品种：${c.statistics?.worstPerformingSymbol ?? '-'}`,
      `优势：${(Array.isArray(c.strengths) ? c.strengths.join('；') : '-') || '无'}`,
      `劣势：${(Array.isArray(c.weaknesses) ? c.weaknesses.join('；') : '-') || '无'}`,
      `改进建议：${(Array.isArray(c.improvementSuggestions) ? c.improvementSuggestions.map((s: any) => s.suggestion).join('; ') : '-') || '无'}`,
    ].join('\n');

    // V2 deep analysis context (if available)
    const v2Parts: string[] = [];
    if (c.assetCategory) v2Parts.push(`标的品类：${c.assetCategory}`);
    if (c.quickSnapshot) {
      const snap = c.quickSnapshot;
      v2Parts.push([
        `行情快照：`,
        `- 情绪偏向：${snap.sentiment || '-'}`,
        `- 关键支撑：${snap.keySupport || '-'}`,
        `- 关键压力：${snap.keyResistance || '-'}`,
        `- 短期偏向：${snap.shortTermBias || '-'}`,
        `- 止损提示：${snap.stopLossHint || '-'}`,
        `- 核心风险：${snap.coreRisk || '-'}`,
      ].join('\n'));
    }
    if (c.assetOverview) {
      const keys = Object.keys(c.assetOverview);
      if (keys.length) v2Parts.push(`标的基础信息：${JSON.stringify(c.assetOverview, null, 0).slice(0, 500)}`);
    }
    if (c.technicalAnalysis) {
      v2Parts.push(`技术面分析：${typeof c.technicalAnalysis === 'object' ? JSON.stringify(c.technicalAnalysis, null, 0).slice(0, 600) : String(c.technicalAnalysis).slice(0, 400)}`);
    }
    if (c.fundSentiment) {
      v2Parts.push(`资金情绪：${typeof c.fundSentiment === 'object' ? JSON.stringify(c.fundSentiment, null, 0).slice(0, 400) : String(c.fundSentiment).slice(0, 300)}`);
    }
    if (c.driversEvents) {
      v2Parts.push(`驱动因子与事件：${JSON.stringify(c.driversEvents, null, 0).slice(0, 500)}`);
    }
    if (c.riskAssessment) {
      v2Parts.push([
        `风险评估：等级=${c.riskAssessment.level || '-'}`,
        `- 因子：${(Array.isArray(c.riskAssessment.riskFactors) ? c.riskAssessment.riskFactors.join('、') : '-')}`,
        `- 说明：${c.riskAssessment.explanation || '-'}`,
      ].join('\n'));
    }
    if (c.tradingSuggestions) {
      v2Parts.push(`分周期趋势参考：${JSON.stringify(c.tradingSuggestions, null, 0).slice(0, 500)}`);
    }

    const fullContext = [v1Context, ...v2Parts].filter(Boolean).join('\n\n');

      const systemPrompt = isZh
        ? `你是一位资深的交易分析顾问（10年+实战经验）。用户正在针对他们的AI深度交易分析报告进行追问。
请基于以下【完整报告上下文】，用中文专业、详尽地回答用户的问题。

=== 完整报告数据 ===
${fullContext}
=== 报告数据结束 ===

重要提醒 — 关于日期和事件的准确性：
报告中的"驱动因子与事件日历"部分的日期是由AI根据报告生成时的上下文推测生成的，
并非来自实时经济日历数据库。特别是对于外汇(Forex)和加密货币(Crypto)品种，以下事件有固定发布规律：
- 非农就业数据(NFP)：每月第一个周五（美东时间8:30）
- CPI通胀数据：每月中旬（通常在13-15号左右）
- FOMC利率决议：每年8次，约每6周一次（通常为周三）
- 美联储会议纪要：FOMC会议后3周左右公布
如果用户询问的具体事件日期与上述规律明显不符（如非农出现在月末），请主动指出该日期可能不准确，
并告知用户正确的发布周期规律。不要盲目重复报告中可能有误的日期。

【核心要求 — 回答风格与深度】
你的回答必须像一位真正的交易专家在自然对话中给出的深度分析，禁止模板化。

1. 【禁止】"关于xxx的分析："开头、"基于共N笔交易的数据..."数据堆砌开场、编号列表主体结构、万能建议清单
2. 【自然对话】直接从问题核心切入，像导师交流一样；先结论后支撑；段落逻辑递进；加入经验性判断
3. 【深度分析】精准选取最相关的2-3个数据点深入解读；多维度交叉验证；给具体参数值；直指用户盲点
4. 【字数】简单事实80-150字；分析建议250-400字(2-3段)；复杂问题400-600字+`
        : `You are a senior trading analysis consultant (10+ years experience). The user is asking a follow-up question about their AI trading analysis report.
Based on the following COMPLETE report context, answer professionally and thoroughly in English.

=== Full Report Data ===
${fullContext}
=== End of Report Data ===

IMPORTANT NOTE — Date Accuracy for Economic Events:
The dates in the "Drivers & Events" section were generated by AI based on context at the time of report generation.
They are NOT from a real-time economic calendar database. For Forex and Crypto instruments, these events have fixed release schedules:
- Non-Farm Payrolls (NFP): First Friday of every month (8:30 AM ET)
- CPI Inflation Data: Mid-month (typically around the 13th-15th)
- FOMC Rate Decision: 8 times per year, approximately every 6 weeks (usually Wednesday)
- Fed Meeting Minutes: ~3 weeks after each FOMC meeting
If a user asks about an event date that clearly contradicts the above patterns (e.g., NFP on a month-end date), proactively flag it as potentially inaccurate
and inform the user of the correct release cycle. Do NOT blindly repeat possibly incorrect dates from the report.

[Core Requirement - Style & Depth]
Your answer must sound like a real trading expert's natural deep analysis, NOT a formatted template report.

1. [NO TEMPLATE STRUCTURE] Absolutely forbid:
   - "Regarding 'xxx':" mechanical opening
   - "Based on your N trades (~X% win rate, avg P&L $X):" data-dump opening
   - Numbered list (1. 2. 3.) as main body structure
   - Generic suggestion checklist
   - Self-revealing fallback phrases like "AI service temporarily unavailable"

2. [NATURAL CONVERSATION] Instead:
   - Cut straight to the core of the question with natural conversational tone
   - State conclusion first, then support with data/logic
   - Logical flow between paragraphs (not bullet points)
   - Add professional insights ("From a practical standpoint...", "This level matters because...")

3. [DEEP ANALYSIS]:
   - Pick only the 2-3 most relevant data points for deep interpretation (don't cite all stats)
   - Cross-validate from technical + fundamental + sentiment dimensions
   - Give specific parameter references for strategies (not vague "control position size")
   - Directly point out user blind spots or misconceptions

4. [LENGTH] Simple facts: 80-150 words; Analysis: 250-400 words (2-3 paragraphs); Complex: 400-600+`;

      logger.info(`Calling AI API for follow-up question`, { model, userId, question: data.question });

      // Fallback chain: primary model → alternative models → mock answer
      const fallbackModels: AIModel[] = [model];
      // Add fallback candidates (exclude the primary model itself)
      if (model !== 'gpt-4o' && isModelAvailable('gpt-4o')) fallbackModels.push('gpt-4o');
      if (model !== 'claude-3-sonnet' && isModelAvailable('claude-3-sonnet')) fallbackModels.push('claude-3-sonnet');
      if (model !== 'gpt-4-turbo' && isModelAvailable('gpt-4-turbo') && !fallbackModels.includes('gpt-4-turbo' as any)) fallbackModels.push('gpt-4-turbo' as any);

      let lastError: Error | null = null;
      let apiSuccess = false;

      for (const tryModel of fallbackModels) {
        try {
          logger.info(`Attempting AI call with model: ${tryModel}`, { userId, question: data.question });
          const response = await aiProviderService.generateCompletion(tryModel, [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: data.question },
          ], {
            temperature: 0.7,
            maxTokens: 4000,
          });

          tokensUsed = response.tokensUsed;
          answer = response.content;
          actualModel = tryModel;
          apiSuccess = true;

          logger.info(`AI API call successful for follow-up`, { tokensUsed, model: response.model, provider: response.provider, wasFallback: tryModel !== model });
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          logger.error(`AI API call failed for model ${tryModel}, trying next...`, { error: lastError.message, userId });
        }
      }

      if (!apiSuccess) {
        logger.error(`All AI models failed for follow-up question, using fallback answer`, {
          attemptedModels: fallbackModels,
          finalError: lastError?.message,
          userId,
        });

        // Build a contextual fallback answer that clearly indicates AI was unreachable
        const c = (report?.content as any) || {};
        const stats = c.statistics || {};
        answer = isZh
          ? `⚠️ **AI模型暂时不可用**（所有备用模型均连接失败）\n\n基于您的报告数据，我可以提供以下参考信息：\n\n您共 **${stats.totalTrades ?? '?'}** 笔交易，胜率 **${stats.winRate ?? '?'}%**，平均盈亏 **$${stats.avgPnL ?? '?'}**。\n\n建议您稍后重试，或切换到其他可用的AI模型后再提问。如需更详细的分析，请查看报告中的「标的基础&行情概览」、「多周期技术面分析」和「风险评估」模块。`
          : `⚠️ **AI models temporarily unavailable** (all backup models failed)\n\nBased on your report data:\n\nYou have **${stats.totalTrades ?? '?'}}** trades, win rate **${stats.winRate ?? '?'}%**, avg P&L **$${stats.avgPnL ?? '?'}}**.\n\nPlease try again later or switch to another available AI model. For detailed analysis, refer to the Asset Overview, Technical Analysis, and Risk Assessment sections in your report.`;
        tokensUsed = 0;
      }

    const responseTimeMs = Date.now() - startTime;

    const answerDoc: AIQuestionDocument = {
      questionId: randomUUID(),
      userId,
      reportId: data.reportId,
      question: data.question,
      answer,
      aiModel: actualModel, // Use the actual model that succeeded (may differ from requested if fallback)
      locale,
      askedAt: new Date(),
      answeredAt: new Date(),
      responseTimeMs,
      contextData: {
        batchIds: [],
        tradeCount: report.metadata.dataPointsAnalyzed,
        dateRange: { start: new Date(report.generatedAt), end: new Date() },
      },
      metadata: {
        tokensUsed,
      },
    };

    const collection = await getCollection<AIQuestionDocument>(MongoCollections.AI_QUESTIONS);
    await collection.insertOne(answerDoc);

    // Record task event for AI follow-up questions — capture credit awards for frontend toast
    // Skip credit award if user already paid with credits (quota exhausted fallback)
    let creditsAwarded = 0;
    if (!options?.skipCreditAward) {
      try {
        const r = await TaskService.recordEvent(userId, 'ai_chat_10', 1);
        creditsAwarded = r.creditsAwarded || 0;
      } catch {
        // Non-critical
      }
    }

    logger.info(`AI Question answered`, { questionId: answerDoc.questionId, userId, time: responseTimeMs, tokensUsed });
    return { ...answerDoc, creditsAwarded };
  }

  /**
   * List questions for a user
   */
  async listQuestions(userId: string, page = 1, limit = 20) {
    const collection = await getCollection<AIQuestionDocument>(MongoCollections.AI_QUESTIONS);
    const skip = (page - 1) * limit;
    const [questions, total] = await Promise.all([
      collection.find({ userId }).sort({ askedAt: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments({ userId }),
    ]);
    return { questions, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Check quota for follow-up questions (9.2)
   * Tier-based: free=0 (not allowed), pro=50/month, prem=100/month
   */
  async checkQuota(userId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscriptions: true },
    });
    if (!user) throw new Error('User not found');

    const sub = user.subscriptions.find(s => s.status === 'active');
    const tier = (sub?.tier || 'free') as 'free' | 'pro' | 'prem';

    const TIER_LIMITS: Record<string, number> = { free: 0, pro: 50, prem: 100 };
    const maxQuestions = TIER_LIMITS[tier] ?? Infinity;

    const collection = await getCollection<AIQuestionDocument>(MongoCollections.AI_QUESTIONS);
    const used = await collection.countDocuments({
      userId, askedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });

    return { allowed: maxQuestions === Infinity || used < maxQuestions, used, limit: maxQuestions === Infinity ? -1 : maxQuestions };
  }

  private buildMockAnswer(question: string, report: any, isZh: boolean): string {
    const c = (report && report.content) || {};
    const stats = c.statistics || {};
    const qLower = question.toLowerCase();
    const totalTrades = stats.totalTrades ?? '?';
    const winRate = stats.winRate ?? '?';
    const avgPnL = stats.avgPnL ?? '?';
    const bestSymbol = stats.bestPerformingSymbol || '-';
    const worstSymbol = stats.worstPerformingSymbol || '-';

    if (qLower.includes('pattern') || qLower.includes('模式') || qLower.includes('习惯')) {
      return isZh
        ? `根据您 ${totalTrades} 笔交易记录的分析：\n\n1. 交易模式方面，报告识别出您的操作具有一定的倾向性特征。建议结合报告中"优势"和"劣势"模块的具体描述来审视这些模式。\n\n2. 如果报告中提到"过度交易"或"过早止盈"，这是最常见的模式问题——建议设置明确的每日最大交易次数限制，并使用ATR或固定比例来设定止盈目标而非凭感觉出场。\n\n3. 具体改进方向可参考报告中的"改进建议"部分，那里针对您的数据给出了优先级排序的行动方案。`
        : `Based on your analysis of ${totalTrades} trades:\n\n1. Your trading patterns show certain behavioral tendencies. Review the "Strengths" and "Weaknesses" sections of your report for specific details.\n\n2. If the report flags "over-trading" or "premature profit-taking", consider setting a daily trade count limit and using ATR-based or fixed-ratio take-profit targets instead of exiting on feel.\n\n3. Refer to the "Improvement Suggestions" section in your report for prioritized action items tailored to your data.`;
    }
    if (qLower.includes('improve') || qLower.includes('改进') || qLower.includes('suggestion') || qLower.includes('建议') || qLower.includes('优化')) {
      return isZh
        ? `根据您的交易数据（${totalTrades}笔，胜率${winRate}%，平均盈亏$${avgPnL}），以下是针对性的改进建议：\n\n1.【止损纪律】如果报告指出止损执行不严，建议使用交易所的硬止损功能（Hard Stop），避免手动干预。每笔交易的初始止损应不超过账户净值的1-2%。\n\n2.【仓位管理】${bestSymbol !== '-' ? `您在${bestSymbol}上表现最好` : '关注您表现最好的品种'}，可以考虑将更多资金配置到高胜率品种上，同时降低${worstSymbol !== '-' ? worstSymbol : '低胜率品种'}的交易频率。\n\n3.【入场时机优化】避免在重大事件（如非农、CPI、FOMC）前后15分钟开仓，除非您有明确的事件交易策略。\n\n4.【记录复盘】建议每周花30分钟回顾本周交易，特别关注亏损单的共同特征。`
        : `Based on your trading data (${totalTrades} trades, ${winRate}% win rate, avg P&L $${avgPnL}), here are targeted improvements:\n\n1. [STOP-LOSS DISCIPLINE] If the report flags loose stop-loss rules, use hard stops at exchange level. Initial risk per trade: max 1-2% of account equity.\n\n2. [POSITION SIZING] ${bestSymbol !== '-' ? `You perform best on ${bestSymbol}` : 'Focus capital on your best performers'}, while reducing frequency on ${worstSymbol !== '-' ? worstSymbol : 'low win-rate instruments'}.\n\n3. [ENTRY TIMING] Avoid opening positions within 15 minutes before/after major events (NFP, CPI, FOMC) unless you have a clear event-trading strategy.\n\n4. [WEEKLY REVIEW] Spend 30 min weekly reviewing trades, focusing on common patterns in losing trades.`;
    }
    if (qLower.includes('symbol') || qLower.includes('stock') || qLower.includes('品种') || qLower.includes('股票') || qLower.includes('forex') || qLower.includes('外汇') || qLower.includes('gold') || qLower.includes('黄金')) {
      return isZh
        ? `关于品种选择的分析：\n\n从您的数据来看：\n• 最佳表现品种：${bestSymbol}\n• 最差表现品种：${worstSymbol}\n\n这表明不同品种之间的表现差异显著。建议：\n1. 分析您在${bestSymbol}上的盈利原因（是否因为对该品种更熟悉？波动特性更适合您的策略？）\n2. 审视${worstSymbol}上的亏损模式（是否频繁逆势操作？仓位过大？）\n3. 考虑将70%的资金集中在2-3个您最有优势的品种上，而不是分散到太多标的。\n\n注意：品种集中化可以提高专注度，但也增加了单一市场风险。`
        : `Regarding instrument selection:\n\nFrom your data:\n• Best performer: ${bestSymbol}\n• Worst performer: ${worstSymbol}\n\nThis indicates significant performance variance across instruments. Suggestions:\n1. Analyze why you profit on ${bestSymbol} (familiarity? volatility fits your strategy?)\n2. Examine loss patterns on ${worstSymbol} (counter-trend trading? oversized positions?)\n3. Consider concentrating ~70% of capital on 2-3 instruments where you have edge.\n\nNote: Concentration improves focus but increases single-market risk.`;
    }
    // Default: context-aware generic answer
    return isZh
      ? `关于"${question}"的分析：\n\n基于您共 ${totalTrades} 笔交易的数据（整体胜率约 ${winRate}%，平均盈亏 $${avgPnL}）：\n\n这个问题涉及您交易行为的具体层面。由于AI服务暂时无法连接以生成深度分析，建议您：\n1. 回顾报告中"标的基础&行情概览"、"多周期技术面分析"、"风险评估"等模块的相关内容\n2. 特别关注报告中提到的核心风险因子和驱动因素\n3. 如需更详细的解答，请稍后重试或切换AI模型后再提问`
      : `Regarding "${question}":\n\nBased on your ${totalTrades} trades (~${winRate}% win rate, avg P&L $${avgPnL}):\n\nThis question touches on specific aspects of your trading behavior. Since the AI service is temporarily unavailable for deep analysis, please:\n1. Review the relevant sections in your report: Asset Overview, Technical Analysis, Risk Assessment modules\n2. Pay special attention to core risk factors and drivers mentioned in the report\n3. Try again later or switch AI model for a more detailed response`;
  }
}

export const aiQuestionService = new AiQuestionService();
