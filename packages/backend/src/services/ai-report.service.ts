import { prisma } from '../lib/prisma';
import { getCollection, MongoCollections, type AIReportDocument, type AssetCategory } from '../lib/mongodb';
import logger from '../lib/logger';
import { randomUUID } from 'crypto';
import {
  aiProviderService,
  isModelAvailable,
  type AIModel,
} from './ai-provider.service';
import { TaskService } from './task.service';
import { notificationService } from './notification.service';
import { economicCalendarService } from './economic-calendar.service';
import { handleNotFoundError } from '../middleware/error.middleware';
import { PreferencesService } from './preferences.service';
import { formatMoney } from '../utils/format-money';
import { getTradeNetPnL } from '@tradeanchor/shared';
import { toTradeRoiInput } from '../utils/trade-roi-mapper';

export interface CreateReportInput {
  aiModel: AIModel;
  locale?: string;
  /** Report type: quick (100-300 words) or deep (full analysis) */
  reportType?: 'quick' | 'deep';
  /** Auto-detected or user-selected asset category */
  assetCategory?: AssetCategory;
  /** Specific trade IDs to analyze (user-selected) */
  tradeIds?: string[];
  /** Filter criteria (used when no specific tradeIds) */
  filters?: {
    symbol?: string;
    direction?: 'long' | 'short';
    startDate?: string;
    endDate?: string;
  };
}

// ============================================================================
// ASSET CATEGORY DETECTION ENGINE
// ============================================================================

/**
 * Detect the dominant asset category from trading symbols
 * Uses pattern matching for US stocks, Forex pairs, and Crypto currencies
 */
export function detectAssetCategory(symbols: string[]): AssetCategory {
  if (!symbols || symbols.length === 0) return 'mixed';

  const categories = symbols.map(sym => {
    const s = sym.toUpperCase().trim();

    // Forex/Commodities pattern: 6-letter currency/metal pairs + precious metal pairs (XAUUSD, XAGJPY, etc.)
    // Standard currency pairs: USDJPY, EURUSD, GBPJPY (6 letters, 3+3 ISO currencies)
    if (/^(USD|EUR|GBP|JPY|AUD|CAD|CHF|NZD|SGD|HKD|NOK|SEK){3}$/.test(s)) {
      return 'forex';
    }
    // Precious metal pairs: XAU/XAG/XPT/XPD + currency (e.g., XAUUSD, XAGEUR)
    if (/^(XAU|XAG|XPT|XPD)(USD|EUR|GBP|JPY|AUD|CAD|CHF|NZD)$/.test(s)) {
      return 'forex';
    }
    // Extended forex: any 6-letter pair ending in common quote currencies
    if (/^[A-Z]{3}(USD|EUR|GBP|JPY)$/.test(s) && !/^[A-Z]{1,5}$/.test(s)) {
      return 'forex';
    }

    // Crypto pattern: XXXUSDT, XXXBTC, XXXETH, or common crypto tickers
    if (/^(BTC|ETH|SOL|BNB|XRP|ADA|DOGE|DOT|AVAX|MATIC|LINK|UNI|ATOM|APT|ARB|OP|FIL|AAVE|GRT)(USDT|USDC|BUSD|BTC|ETH)?$/.test(s)
      || s.includes('USDT') || s.includes('USDC')) {
      return 'crypto';
    }

    // Futures/Commodities pattern (common futures codes)
    if (/^(ES|NQ|YM|CL|NG|GC|SI|ZC|ZS|ZW|ZN|ZF|RTY|EMini)/i.test(s)) {
      return 'futures';
    }

    // US Stocks pattern: 1-5 letter uppercase codes (AAPL, TSLA, MSFT, etc.)
    if (/^[A-Z]{1,5}$/.test(s)) {
      return 'us_stocks';
    }

    return 'unknown';
  });

  // Count occurrences of each category
  const counts = categories.reduce((acc, cat) => {
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Find dominant category (excluding unknown)
  const sorted = Object.entries(counts)
    .filter(([cat]) => cat !== 'unknown')
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0 || sorted[0][1] < symbols.length * 0.5) {
    return 'mixed'; // No clear dominant category
  }

  return (sorted[0][0] as AssetCategory) || 'mixed';
}

/**
 * Get human-readable name for asset category
 */
export function getCategoryName(category: AssetCategory, isZh: boolean): string {
  const names: Record<AssetCategory, { zh: string; en: string }> = {
    us_stocks: { zh: '美股', en: 'US Stocks' },
    forex: { zh: '外汇', en: 'Forex' },
    crypto: { zh: '加密货币', en: 'Crypto' },
    futures: { zh: '期货', en: 'Futures' },
    mixed: { zh: '混合', en: 'Mixed' },
  };
  const n = names[category] || names.mixed;
  return isZh ? n.zh : n.en;
}

export class AiReportService {
  /**
   * Generate an AI trading analysis report with asset category differentiation (v2)
   * @param options.skipCreditAward When true, user already paid with credits — skip TaskService credit award
   */
  async generateReport(userId: string, data: CreateReportInput, options?: { skipCreditAward?: boolean }): Promise<AIReportDocument> {
    const startTime = Date.now();

    // Build trade query - support specific IDs, filter criteria, or all trades
    const whereClause: any = { userId };

    if (data.tradeIds && data.tradeIds.length > 0) {
      whereClause.id = { in: data.tradeIds };
    } else if (data.filters) {
      if (data.filters.symbol) {
        whereClause.tradingSymbol = { contains: data.filters.symbol, mode: 'insensitive' };
      }
      if (data.filters.direction) {
        whereClause.positionDirection = data.filters.direction;
      }
      if (data.filters.startDate) {
        whereClause.entryTimestamp = { ...(whereClause.entryTimestamp || {}), gte: new Date(data.filters.startDate) };
      }
      if (data.filters.endDate) {
        whereClause.entryTimestamp = { ...(whereClause.entryTimestamp || {}), lte: new Date(data.filters.endDate) };
      }
    }
    if (!whereClause.exitPrice) {
      whereClause.exitPrice = { not: null };
    }

    const trades = await prisma.trade.findMany({
      where: whereClause,
      orderBy: { entryTimestamp: 'asc' },
    });

    if (trades.length === 0) throw handleNotFoundError('trades');

    const prefs = await PreferencesService.get(userId);
    const reportCurrency = prefs.baseCurrency || 'USD';

    // Calculate statistics (net P&L after commission/swap)
    const totalTrades = trades.length;
    const totalPnL = trades.reduce(
      (s, t) => s + getTradeNetPnL(toTradeRoiInput(t)),
      0,
    );
    const winning = trades.filter(t => Number(t.pnl || 0) > 0);
    const winRate = Math.round((winning.length / totalTrades) * 10000) / 100;
    const avgPnL = Math.round((totalPnL / totalTrades) * 100) / 100;

    // Find patterns
    const symbolStats = new Map<string, { count: number; pnl: number }>();
    trades.forEach(t => {
      const e = symbolStats.get(t.tradingSymbol) || { count: 0, pnl: 0 };
      symbolStats.set(t.tradingSymbol, { count: e.count + 1, pnl: e.pnl + Number(t.pnl || 0) });
    });
    const sortedSymbols = [...symbolStats.entries()].sort((a, b) => b[1].pnl - a[1].pnl);

    // Detect long/short patterns
    const longTrades = trades.filter(t => t.positionDirection === 'long');
    const shortTrades = trades.filter(t => t.positionDirection === 'short');
    const longWinRate = longTrades.length > 0 ? Math.round(longTrades.filter(t => Number(t.pnl || 0) > 0).length / longTrades.length * 10000) / 100 : 0;
    const shortWinRate = shortTrades.length > 0 ? Math.round(shortTrades.filter(t => Number(t.pnl || 0) > 0).length / shortTrades.length * 10000) / 100 : 0;
    const maxDrawdown = Math.abs(Math.min(...trades.map(t => Number(t.pnl || 0)), 0));

    // Prepare trade data for AI analysis (anonymized)
    const tradeDataForAnalysis = trades.map(t => ({
      symbol: t.tradingSymbol,
      direction: t.positionDirection,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      pnl: t.pnl,
      quantity: t.quantity,
      timestamp: t.entryTimestamp,
    }));

    // Extract symbols for category detection
    const uniqueSymbols = [...new Set(trades.map(t => t.tradingSymbol))];

    // V2: Detect asset category (auto-detect unless user specified)
    const assetCategory: AssetCategory = data.assetCategory || detectAssetCategory(uniqueSymbols);

    // V2: Determine report type (default to deep for full analysis)
    const reportType: 'quick' | 'deep' = data.reportType || 'deep';

    const locale = data.locale || 'en';
    const isZh = locale.startsWith('zh');
    // Use user-specified model first, then fall back to env default
    const model: AIModel = (data.aiModel || process.env.OPENAI_MODEL || 'gpt-4o') as AIModel;

    // Verify model is available
    if (!isModelAvailable(model)) {
      logger.error(`Model ${model} is not available. Check API key configuration.`);
      throw new Error(`AI model ${model} is not configured. Please check your API key settings.`);
    }

    let content: AIReportDocument['content'];
    let tokensUsed = 0;

    try {
      // V2: Build differentiated prompts based on asset category and report type
      const categoryName = getCategoryName(assetCategory, isZh);

      const systemPrompt = this.buildSystemPrompt(assetCategory, reportType, isZh, categoryName);
      const userPrompt = await this.buildUserPrompt(
        { totalTrades, totalPnL, winRate, avgPnL, maxDrawdown, longWinRate, shortWinRate },
        sortedSymbols,
        tradeDataForAnalysis,
        longTrades.length,
        shortTrades.length,
        uniqueSymbols,
        isZh,
        assetCategory,
        reportCurrency,
      );

      logger.info(`Calling AI API for report generation`, {
        model,
        userId,
        tradeCount: totalTrades,
        assetCategory,
        reportType,
      });

      // Adjust maxTokens based on report type and language (English needs more tokens for same content density)
      // Deep reports require significantly more tokens: 7 analysis modules + category-specific + summary + strengths/weaknesses/suggestions
      let baseMaxTokens: number;
      if (reportType === 'quick') {
        baseMaxTokens = 4000;  // Quick report: compact but complete
      } else {
        // Deep report: generous token budget for comprehensive multi-module analysis
        baseMaxTokens = isZh ? 12000 : 16000;  // English needs ~33% more tokens for equivalent detail
      }

      // Cap at model's maximum supported output tokens (from registry)
      const { maxTokens: modelMaxTokens } = (await import('./ai-provider.service')).MODEL_REGISTRY[model] || { maxTokens: 16384 };
      const maxTokens = Math.min(baseMaxTokens, modelMaxTokens);

      const response = await aiProviderService.generateCompletion(model, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], {
        maxTokens,
      });

      tokensUsed = response.tokensUsed;
      let aiContent = response.content;

      // Strip markdown code block wrappers if present (AI models sometimes return ```json ... ```)
      const jsonMatch = aiContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        aiContent = jsonMatch[1].trim();
        logger.info('Stripped markdown code block wrapper from AI response');
      }

      // Attempt to repair common JSON issues before parsing
      // AI models may return: trailing commas, unclosed strings/brackets, unescaped newlines in strings
      let parsedContent: any;
      try {
        parsedContent = JSON.parse(aiContent);
      } catch (parseErr) {
        logger.warn('Initial JSON parse failed, attempting repair', { error: (parseErr as Error).message, contentLength: aiContent.length });

        // Repair strategy 1: Trim to last complete JSON object by finding balanced braces
        let repaired = aiContent;
        
        // Remove any trailing text after the last closing brace of the root object
        const lastBrace = repaired.lastIndexOf('}');
        if (lastBrace > 0) {
          repaired = repaired.substring(0, lastBrace + 1);
        }

        // Fix common issues: trailing commas before } or ]
        repaired = repaired.replace(/,\s*([}\]])/g, '$1');

        // Fix unescaped newlines inside string values
        repaired = repaired.replace(/(?<!\\)(?:\\\\)*\n/g, '\\n');

        // Attempt repair up to 2 times with progressive trimming
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            parsedContent = JSON.parse(repaired);
            logger.info(`JSON repaired successfully on attempt ${attempt + 1}`);
            break;
          } catch {
            // If still failing on second attempt, trim more aggressively
            if (attempt === 0) {
              // Try removing the last field that might be incomplete
              const lastCommaBeforeBrace = repaired.lastIndexOf(',', repaired.lastIndexOf('}') - 1);
              if (lastCommaBeforeBrace > 0) {
                repaired = repaired.substring(0, lastCommaBeforeBrace) + '\n}';
              }
            } else {
              throw parseErr;
            }
          }
        }
      }

      // V2: Enrich with calculated values and metadata
      content = {
        ...parsedContent,
        // Ensure V2 fields are set
        reportType,
        assetCategory,
        // Ensure legacy statistics are accurate
        statistics: {
          ...parsedContent.statistics,
          totalTrades,
          winRate,
          avgPnL,
          maxDrawdown,
          bestPerformingSymbol: sortedSymbols[0]?.[0] || 'N/A',
          worstPerformingSymbol: sortedSymbols[sortedSymbols.length - 1]?.[0] || 'N/A',
          timeAnalysis: {
            longWinRate,
            shortWinRate,
            longCount: longTrades.length,
            shortCount: shortTrades.length,
          },
        },
      };

      logger.info(`AI API call successful`, { tokensUsed, model: response.model, provider: response.provider });
    } catch (error) {
      logger.error('AI API call failed, falling back to rule-based analysis', { error: error instanceof Error ? error.message : error });

      // Fallback to rule-based analysis if API fails
      content = this.buildAnalysisContent(trades, winRate, avgPnL, sortedSymbols, totalPnL, locale, assetCategory, reportType, reportCurrency);
      tokensUsed = Math.round(totalTrades * 50 + 200);
    }

    const generationTimeMs = Date.now() - startTime;

    const reportDoc: AIReportDocument = {
      reportId: randomUUID(),
      userId,
      batchIds: data.tradeIds || [],
      locale,
      aiModel: data.aiModel,
      generatedAt: new Date(),
      content,
      metadata: {
        generationTimeMs,
        tokensUsed,
        dataPointsAnalyzed: totalTrades,
      },
    };

    const collection = await getCollection<AIReportDocument>(MongoCollections.AI_REPORTS);
    await collection.insertOne(reportDoc);

    // Record task events for AI report generation
    let creditsAwarded = 0;
    if (!options?.skipCreditAward) {
      try {
        const r1 = await TaskService.recordEvent(userId, 'first_ai_report', 1);
        const r2 = await TaskService.recordEvent(userId, 'ai_reports_5', 1);
        creditsAwarded = (r1.creditsAwarded || 0) + (r2.creditsAwarded || 0);
      } catch {
        // Non-critical
      }
    }

    logger.info(`AI Report generated`, {
      reportId: reportDoc.reportId,
      userId,
      model: data.aiModel,
      time: generationTimeMs,
      tokensUsed,
      assetCategory,
      reportType,
    });

    // Send AI report ready notification (email + in-app)
    try {
      await notificationService.notifyAiReportReady(userId, reportDoc.reportId, data.aiModel);
    } catch {
      // Non-critical
    }

    return { ...reportDoc, creditsAwarded };
  }

  // ============================================================================
  // V2: DIFFERENTIATED PROMPT FACTORY
  // ============================================================================

  /**
   * Build system prompt based on asset category and report type
   */
  private buildSystemPrompt(assetCategory: AssetCategory, reportType: 'quick' | 'deep', isZh: boolean, categoryName: string): string {
    if (reportType === 'quick') {
      return isZh
        ? this.getQuickReportSystemZh(categoryName)
        : this.getQuickReportSystemEn(categoryName);
    }

    // Deep report with category-specific modules
    const categorySpecificModule = this.getCategorySpecificPrompt(assetCategory, isZh);
    return isZh
      ? this.getDeepReportSystemZh(categoryName, categorySpecificModule)
      : this.getDeepReportSystemEn(categoryName, categorySpecificModule);
  }

  /**
   * Build user prompt with trade data and statistics
   */
  private async buildUserPrompt(
    stats: { totalTrades: number; totalPnL: number; winRate: number; avgPnL: number; maxDrawdown: number; longWinRate: number; shortWinRate: number },
    sortedSymbols: [string, { count: number; pnl: number }][],
    tradeDataForAnalysis: any[],
    longCount: number,
    shortCount: number,
    uniqueSymbols: string[],
    isZh: boolean,
    assetCategory: AssetCategory,
    currency: string,
  ): Promise<string> {
    const fmt = (n: number) => formatMoney(n, currency, isZh ? 'zh-CN' : 'en-US');
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    // Generate 7-day reference calendar with exact day-of-week for AI to map correctly
    const dayNamesZh = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const calendarRows: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dow = d.getUTCDay();
      calendarRows.push(`  ${d.toISOString().split('T')[0]}  ${isZh ? dayNamesZh[dow] : dayNamesEn[dow]}`);
    }
    const calendarTable = calendarRows.join('\n');

    const baseStats = isZh
      ? `【基础统计数据】
- 📅 当前日期（报告生成日）：${now.toLocaleDateString('zh-CN', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
- 品种类别：${getCategoryName(assetCategory, true)}
- 分析交易数：${stats.totalTrades} 笔
- 涉及品种：${uniqueSymbols.join(', ')}
- 总盈亏：${fmt(stats.totalPnL)}
- 胜率：${stats.winRate}%
- 平均每笔盈亏：${fmt(stats.avgPnL)}
- 最大回撤：${fmt(stats.maxDrawdown)}
- 多头交易：${longCount} 笔（胜率 ${stats.longWinRate}%）
- 空头交易：${shortCount} 笔（胜率 ${stats.shortWinRate}%）
- 最佳品种：${sortedSymbols[0]?.[0] || 'N/A'} (${fmt(sortedSymbols[0]?.[1]?.pnl ?? 0)})
- 最差品种：${sortedSymbols[sortedSymbols.length - 1]?.[0] || 'N/A'}`
      : `【Basic Statistics】
- 📅 Current Date (Report Generated): ${new Date().toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
- Asset Category: ${getCategoryName(assetCategory, false)}
- Total Trades Analyzed: ${stats.totalTrades}
- Symbols Traded: ${uniqueSymbols.join(', ')}
- Total P&L: ${fmt(stats.totalPnL)}
- Win Rate: ${stats.winRate}%
- Avg P&L per Trade: ${fmt(stats.avgPnL)}
- Max Drawdown: ${fmt(stats.maxDrawdown)}
- Long Positions: ${longCount} trades (Win Rate: ${stats.longWinRate}%)
- Short Positions: ${shortCount} trades (Win Rate: ${stats.shortWinRate}%)
- Best Symbol: ${sortedSymbols[0]?.[0] || 'N/A'} (${fmt(sortedSymbols[0]?.[1]?.pnl ?? 0)})
- Worst Symbol: ${sortedSymbols[sortedSymbols.length - 1]?.[0] || 'N/A'}`;

    const dateRuleBlock = isZh
      ? `【⚠️ 事件日历日期准确性 — 严格禁止编造日期】
当前日期：${todayStr}

📅 未来7天日历参考：
${calendarTable}

【核心原则】你无法获取实时经济日历数据，因此：
1. 🔴 禁止推算！禁止使用"第N个周X"公式反推具体日期 — 每月实际发布日会因节假日、日程调整而变化，你的推算几乎一定是错的
2. ✅ 允许的写法：
   - 确定已知的事件（如已公布的央行会议日程）：写精确日期 YYYY-MM-DD HH:mm
   - 无法确认日期的重大事件：只写事件名称 + 大致时间窗口，date字段填 "TBD"
     例：{"date":"TBD (预计2026年6月初,待确认)","event":"美国非农就业数据(NFP)","impact":"..."}
3. ❌ 绝对禁止的行为：
   - 看到今天是5月29日就猜"下周五6月5日是非农" — 你不知道本月非农到底是哪天
   - 用"每月第一个周五"这类经验公式硬套 — 实际发布日常有例外
4. date格式：确定日期用 YYYY-MM-DD HH:mm(北京时)；不确定用 "TBD (说明)"`
      : `【⚠️ Event Calendar Date Accuracy — NEVER fabricate dates】
Current date: ${todayStr}

📅 Next 7 Days Calendar Reference:
${calendarTable}

【Core Principle】You do NOT have access to real-time economic calendar data, therefore:
1. 🔴 NEVER calculate/guess! Do NOT use formulas like "Nth weekday of month" to derive dates — actual release dates vary each month due to holidays and schedule changes; your calculation will almost certainly be wrong
2. ✅ Acceptable approaches:
   - For confirmed events with known schedules: use exact date YYYY-MM-DD HH:mm
   - For major events where you cannot confirm the date: write the event name + approximate time window, set date to "TBD"
     e.g.: {"date":"TBD (expected early June 2026, unconfirmed)","event":"US Non-Farm Payrolls (NFP)","impact":"..."}
3. ❌ Absolutely PROHIBITED:
   - Guessing "next Friday Jun 5 is NFP" just because today is May 29 — you do NOT know the actual NFP date this month
   - Using rules like "1st Friday of each month" — there are frequent exceptions
4. Date format: YYYY-MM-DD HH:mm (Beijing Time) for confirmed dates; "TBD (note)" for unconfirmed`;

    const tradeDataLabel = isZh ? '【详细交易数据】' : '【Detailed Trade Data】';
    const finalInstruction = isZh
      ? '\n请基于以上数据，严格按照 System Prompt 中定义的 JSON 格式输出分析报告。'
      : '\nPlease analyze the above data and output the analysis report strictly following the JSON format defined in the System Prompt.';

    // Fetch real-time economic calendar data from external API
    const calendarText = await economicCalendarService.getPromptText(isZh);

    return baseStats + '\n\n' + dateRuleBlock + '\n'
      + calendarText + '\n\n'
      + tradeDataLabel + '\n'
      + JSON.stringify(tradeDataForAnalysis, null, 2)
      + finalInstruction;
  }

  // --- QUICK REPORT PROMPTS ---

  private getQuickReportSystemZh(categoryName: string): string {
    return `你是一位拥有15年以上经验的资深${categoryName}交易分析师。请根据用户提供的真实交易数据，生成一份详实、有深度的极速简报。简洁不等于简陋——每个字段都必须有实质性内容。

【输出要求 — 严格JSON格式】
报告必须严格使用以下JSON格式（不要添加markdown代码块标记）：
{
  "reportType": "quick",
  "assetCategory": "us_stocks|forex|crypto|futures|mixed",
  "quickSnapshot": {
    "sentiment": "bullish|bearish|neutral（必须引用胜率或盈亏趋势数据作为依据）",
    "keySupport": "从交易数据中推导的具体支撑位。格式：'¥XXX-XXX区间：[基于实际交易数据的推理]'。示例：'178-182元区间：多次入场价集中区域+近期反弹位'。必须15-30字。",
    "keyResistance": "从交易数据中推导的具体压力位。参考keySupport格式。必须引用实际的出场价格或交易高点。15-30字。",
    "shortTermBias": "2-3句多空方向判断。对比多头vs空头胜率、近期交易盈亏趋势、品种集中度等具体指标。20-40字。",
    "stopLossHint": "具体止损建议。根据数据中的最大回撤百分比、最大单笔亏损或平均不利偏移计算。给出具体百分比或金额。20-35字。",
    "coreRisk": "从该交易者数据中识别的#1风险。是仓位过大？过度交易？相关性风险？回撤恢复慢？必须有数据支撑。20-35字。"
  },
  "summary": "综合摘要180-280字，必须覆盖以下全部维度：(1)整体绩效评估，包含确切胜率、总盈亏、分析交易笔数；(2)从持仓周期和仓位规模推断的交易风格特征；(3)关键行为观察——连亏/连胜模式、纪律性信号、择时质量；(4)从交易的品种和时间推断的市场环境背景；(5)针对已观察到弱点的可操作风险管理建议。每段必须包含交易数据中的具体数字。",
  "tradingPatterns": [{"pattern":"具体模式名称（如'NVDA早盘反转'）","frequency":"X/Y笔交易(Z%)","impact":"影响总盈亏$X,XXX","examples":["DATE: SYMBOL 方向 结果 $PnL"]}],
  "strengths": ["每条优势须包含数据中的具体指标。例：'多头选股能力强：13笔多头交易胜率85%，贡献$4,200盈利'。最少12字。"],
  "weaknesses": ["每条劣势须量化问题。例：'盈亏比严重失衡：平均盈利$340 vs 平均亏损-$1,120(负3.3:1)'。最少12字。"],
  "improvementSuggestions": [{"priority":"high|medium|low","suggestion":"针对性可操作建议，包含实施步骤","expectedImpact":"量化预期改善效果（如'按历史模拟可减少约30%回撤'）"}],
  "statistics": {"totalTrades":number,"winRate":number,"avgPnL":number,"maxDrawdown":number,"bestPerformingSymbol":"品种","worstPerformingSymbol":"品种","timeAnalysis":{}}
}

【关键质量规则 — 违反将被拒绝】

🚨 绝对禁止（零容忍）：
- ❌ "N/A"、"n/a"、"NA"、"-"、"None"、"TBD"、"null"、"未检测到"、 "无数据" 等占位符
- ❌ 泛泛而谈如"根据近期低点设置止损"——你手中有真实价格数据，用它来计算
- ❌ 只有数字没有解释
- ❌ 一个词回答（如只写"看多"）
- ❌ 把字段名复制为值
- ❌ 不引用具体交易数据的空泛表述

✅ 必须执行方法——你拥有含入场价/出场价、盈亏、日期、品种的真实交易数据：
1. 从数据集的最小/最大价格推导支撑/压力位
2. 从各笔交易的盈亏方差计算波动率
3. 对比多头vs空头表现确定偏向
4. 从最大单笔亏损或最大回撤百分比估算止损
5. 从品种频率分布识别集中度风险

✅ 最低内容要求：
- quickSnapshot.keySupport: ≥15字，含从数据推导的具体价位区间
- quickSnapshot.keyResistance: ≥15字，含从数据推导的具体价位区间  
- quickSnapshot.shortTermBias: ≥20字，对比多空统计数据
- quickSnapshot.stopLossHint: ≥20字，含计算出的%或金额
- quickSnapshot.coreRisk: ≥20字，用数据证据指出#1风险
- summary: 180-280字最低要求，覆盖全部5个维度
- strengths: ≥2条，每条≥12字，带数据指标
- weaknesses: ≥2条，每条≥12字，量化问题
- improvementSuggestions: ≥2条，建议≥20字，预期效果量化

⚠️ 如果确实无法从可用数据中确定某个值，请说明："基于现有数据推断：[你的最佳合理评估及方法论解释]"。禁止使用N/A。`;
  }

  private getQuickReportSystemEn(categoryName: string): string {
    return `You are a senior ${categoryName} trading analyst with 15+ years of experience. Generate a THOROUGH and DETAILED quick snapshot based on the user's actual trading data. You MUST produce substantive analysis — brevity is NOT a virtue here.

【Output Requirements — STRICT JSON FORMAT】
The report MUST use exactly this JSON format (do not add markdown code block markers):
{
  "reportType": "quick",
  "assetCategory": "us_stocks|forex|crypto|futures|mixed",
  "quickSnapshot": {
    "sentiment": "bullish|bearish|neutral — must be justified by referencing win rate % or P&L trend from data",
    "keySupport": "SPECIFIC support price level derived from your trade entry/exit prices. Format: '$XXX-YYY: [reasoning based on actual trade data]'. Example: '$178-182: Multiple entries clustered near this zone + recent bounce area'. Must be 15-30 words.",
    "keyResistance": "SPECIFIC resistance price level derived from your trade data. Format similar to keySupport. Must reference actual exit prices or highs from trades. Must be 15-30 words.",
    "shortTermBias": "2-3 sentence directional bias. Reference specific metrics: compare long vs short win rate, recent trade P&L momentum, symbol concentration. 20-40 words.",
    "stopLossHint": "Concrete stop-loss recommendation. Calculate from max drawdown % observed in trades, largest losing trade magnitude, or average adverse excursion. Give a percentage or dollar amount. 20-35 words.",
    "coreRisk": "The #1 risk identified from THIS trader's data. Is it position sizing? Overtrading? Correlation? Drawdown recovery time? Be specific with numbers. 20-35 words."
  },
  "summary": "COMPREHENSIVE 180-280 word analysis covering ALL of these dimensions: (1) Overall performance assessment with exact win rate, total P&L, number of trades analyzed; (2) Trading style inference from holding period patterns and position sizing trends; (3) Key behavioral observations — streak patterns, emotional discipline signals, timing quality; (4) Market regime context inferred from which symbols were traded and when; (5) Actionable risk management takeaway tied to observed weaknesses. Every paragraph must contain specific numbers from the trade data.",
  "tradingPatterns": [{"pattern":"Specific pattern name (e.g., 'Morning reversal on NVDA')","frequency":"X out of Y trades (Z%)","impact":"$X,XXX total P&L impact","examples":["Trade on DATE: SYMBOL direction RESULT $PnL"]}],
  "strengths": ["Each strength must include a specific metric from data. E.g., 'Strong long-side selection: 85% win rate on 13 long positions generating $4,200'. Minimum 12 words each."],
  "weaknesses": ["Each weakness must quantify the problem. E.g., 'Poor risk/reward ratio: Average winner $340 vs average loser -$1,120 (3.3:1 negative)'. Minimum 12 words each."],
  "improvementSuggestions": [{"priority":"high|medium|low","suggestion":"Specific actionable suggestion addressing an observed weakness, with implementation steps","expectedImpact":"Quantified expected improvement (e.g., 'Could reduce drawdown by ~30% based on historical simulation')"}],
  "statistics": {"totalTrades":number,"winRate":number,"avgPnL":number,"maxDrawdown":number,"bestPerformingSymbol":"symbol","worstPerformingSymbol":"symbol","timeAnalysis":{}}
}

【CRITICAL QUALITY RULES — YOUR OUTPUT WILL BE REJECTED IF VIOLATED】

🚨 ABSOLUTELY FORBIDDEN (ZERO TOLERANCE):
- ❌ "N/A", "n/a", "NA", "-", "None", "TBD", "null", "undefined", "unidentified", "no data"
- ❌ Generic filler like "Set based on recent lows/highs" — you HAVE real prices in the data, USE THEM
- ❌ Single number without explanation (e.g., just "$150")
- ❌ One-word answers (e.g., just "bullish")
- ❌ Copying field name as value
- ❌ Vague statements without referencing specific trade data points

✅ MANDATORY APPROACH — YOU HAVE REAL TRADE DATA WITH ENTRY/EXIT PRICES, PNL, DATES, SYMBOLS:
1. DERIVE support/resistance from min/max prices in your dataset
2. CALCULATE volatility from P&L variance across trades
3. COMPARE long vs short performance to determine bias
4. ESTIMATE stop-loss from largest losing trade or max drawdown percentage
5. IDENTIFY concentration risk from symbol frequency distribution

✅ MINIMUM CONTENT ENFORCEMENT:
- quickSnapshot.keySupport: ≥15 words with SPECIFIC price range from data
- quickSnapshot.keyResistance: ≥15 words with SPECIFIC price range from data
- quickSnapshot.shortTermBias: ≥20 words comparing long vs short stats
- quickSnapshot.stopLossHint: ≥20 words with calculated % or $ amount
- quickSnapshot.coreRisk: ≥20 words identifying #1 risk with evidence
- summary: 180-280 words MINIMUM covering ALL 5 required dimensions above
- strengths: ≥2 items, each ≥12 words with data-backed metrics
- weaknesses: ≥2 items, each ≥12 words quantifying the problem
- improvementSuggestions: ≥2 items with priority, suggestion ≥20 words, expected impact

⚠️ If you truly cannot determine a value from available data, state: "Inferred from available data: [your best reasoned assessment with methodology explanation]". Never use N/A.`;
  }

  // --- DEEP REPORT PROMPTS ---

  private getDeepReportSystemZh(categoryName: string, categorySpecific: string): string {
    return `你是一位资深的${categoryName}交易分析师。请根据用户提供的交易数据，生成一份专业深度的AI分析报告。

【输出格式要求】
严格使用以下JSON格式输出（不要添加markdown代码块标记）：
{
  "reportType": "deep",
  "assetCategory": "${this.getAssetCategoryKey()}",

  "quickSnapshot": {
    "sentiment": "bullish|bearish|neutral",
    "keySupport": "关键支撑位",
    "keyResistance": "关键压力位",
    "shortTermBias": "短期多空判断",
    "stopLossHint": "止损提示",
    "coreRisk": "核心风险"
  },

  "assetOverview": {
    "basicInfo": {"name":"标的名称","code":"代码","market":"市场"},
    "pricePerformance": {"dailyRange":"日内振幅","weeklyChange":"近一周变化","volatility":"波动率"},
    "marketCorrelation": "大盘联动性描述",
    "trendQualification": "单边上涨|单边下跌|区间震荡|破位|横盘整理"
  },

  "technicalAnalysis": {
    "timeframeConvergence": "分时/1H/4H/日线/周线多周期趋势共振判断",
    "coreIndicators": {
      "ma": "均线(MA)信号解读",
      "macd": "MACD指标状态",
      "rsi": "RSI超买超卖判断",
      "boll": "布林带位置",
      "kdj": "KDJ指标信号"
    },
    "keyLevels": {
      "strongSupport": "强支撑位",
      "weakSupport": "弱支撑位",
      "strongResistance": "强压力位",
      "weakResistance": "弱压力位"
    },
    "patternAnalysis": "K线形态、趋势线、箱体、通道等技术形态有效性判断"
  },

  "fundSentiment": {
    "capitalFlow": "主力/大额资金净流入流出情况",
    "longShortRatio": "多空情绪比例、筹码集中度",
    "positionData": "持仓数据（如有）"
  },

  "driversEvents": {
    "currentFactors": [{"type":"positive|negative","factor":"当前驱动因素"}],
    "upcomingEvents": [{"date":"精确日期时间（格式：YYYY-MM-DD HH:mm，含具体时段如'20:30美盘开盘前'）","event":"事件名称","impact":"预期影响"}]
  },

  "riskAssessment": {
    "level": "high|medium|low",
    "riskFactors": ["风险因素列表"],
    "explanation": "风险等级解释说明"
  },

  "tradingSuggestions": {
    "intraday": {"trendBias":"短期趋势描述（偏多/偏空/震荡）","keyObservation":"日内关键观察点","volatilityNote":"波动特征说明"},
    "swing": {"trendLogic":"波段趋势逻辑分析","supportResistanceContext":"支撑压力区间参考","momentumSignal":"动量信号评估"},
    "midterm": {"trendAssessment":"中期趋势综合判断","cyclePhase":"所处周期阶段","structuralNotes":"结构性因素备注"}
  },

  "categorySpecific": ${categorySpecific},

  "summary": "总体摘要（200-400字）",
  "tradingPatterns": [{"pattern":"模式","frequency":数字,"impact":"影响","examples":[]}],
  "strengths": ["优势列表"],
  "weaknesses": ["劣势列表"],
  "improvementSuggestions": [{"priority":"high|medium|low","suggestion":"建议","expectedImpact":"预期影响"}],
  "statistics": {"totalTrades":数字,"winRate":数字,"avgPnL":数字,"maxDrawdown":数字,"bestPerformingSymbol":"品种","worstPerformingSymbol":"品种","timeAnalysis":{}}
}

【七大通用分析模块】
模块1: 标的基础 & 行情快照 - 基本信息、价格表现、大盘联动、行情定性
模块2: 多周期技术面分析 - 周期共振、核心指标(MA/MACD/RSI/BOLL/KDJ)、关键价位、形态分析
模块3: 资金 & 市场情绪 - 资金流向、多空情绪、持仓数据
模块4: 驱动因子 & 事件日历 - 现有利好/利空、未来1~3天关键事件
模块5: 风险分级识别 - 高/中/低风险分级、发生概率+冲击幅度
模块6: 分周期趋势参考 - 日内短线、波段、中线各周期的趋势性分析与观察（不含具体买卖指令或价位）
模块7: 交易规则提醒 - 流动性提示、差价、休市时间等规则

【⚠️ 输出长度要求 — 必须保证内容充实】
为与英文报告保持一致的深度分析质量，每个字段必须包含实质性分析内容：
- summary: 200-350 字综合分析，覆盖七大模块核心发现，引用具体数据指标
- quickSnapshot 各字段: 每条 20-35 字，含从交易数据推导的具体价位或依据
- assetOverview 各字段值: 每条 30-50 字，基于实际交易数据推理
- technicalAnalysis 各字段值: 每条 40-60 字，结合入场出场价格和时间分布分析
- fundSentiment 各字段值: 每条 30-50 字，从多空持仓和盈亏模式推断
- driversEvents.currentFactors: 每条 factor 25-40 字，关联宏观环境与品种
- driversEvents.upcomingEvents: event 15-25 字, impact 25-35 字含情景分析
- riskAssessment.explanation: 80-120 字，引用回撤和集中度数据多维度论证
- tradingSuggestions 各周期各字段: 每条 30-45 字，给出数据支撑的观察
- categorySpecific 各字段值: 每条 45-65 字，展现品类专业深度
- strengths/weaknesses: 每条 15-25 字，各提供恰好 5 条（不足则综合推导）
- improvementSuggestions.suggestion: 每条 25-40 字，针对已识别弱点给可操作建议
- 总体原则：结论优先、数据驱动，每个判断必须有交易记录中的数字支撑

🚨 绝对禁止（零容忍）：
- ❌ "N/A"、"n/a"、"NA"、"-"、"None"、"TBD"、"null"、"未检测到"、"无数据"
- ❌ 泛泛而谈如"根据近期低点设置止损"——你手中有真实价格数据，用它来计算
- ❌ 只有数字没有解释
- ❌ 一个词回答（如只写"看多"）
- ❌ 把字段名复制为值
- ❌ 不引用具体交易数据的空泛表述

✅ 必须执行方法——你拥有含入场价/出场价、盈亏、日期、品种的真实交易数据：
1. 从数据集的最小/最大价格推导支撑/压力位
2. 从各笔交易的盈亏方差计算波动率
3. 对比多头vs空头表现确定偏向
4. 从最大单笔亏损或最大回撤百分比估算止损
5. 从品种频率分布识别集中度风险

质量检查：输出前确认每个非 statistics 字段都有≥15字的原创分析。不足则扩充。`;
  }

  private getDeepReportSystemEn(categoryName: string, categorySpecific: string): string {
    return `You are a senior ${categoryName} trading analyst. Generate a professional in-depth AI analysis report based on the user's trading data.

【Output Format Requirements】
Strictly use the following JSON format (do not add markdown code block markers):
{
  "reportType": "deep",
  "assetCategory": "${this.getAssetCategoryKey()}",

  "quickSnapshot": {
    "sentiment": "bullish|bearish|neutral",
    "keySupport": "Key support level with specific price zone and reasoning (e.g., '2310-2320 area: recent swing low + psychological level')",
    "keyResistance": "Key resistance level with specific price zone and reasoning",
    "shortTermBias": "Short-term directional bias (bullish/bearish/rangebound) with 1-2 sentence justification",
    "stopLossHint": "Specific stop-loss placement guidance based on recent volatility and ATR",
    "coreRisk": "The single most important risk factor the trader should be aware of right now"
  },

  "assetOverview": {
    "basicInfo": {"name":"Full instrument name","code":"Ticker symbol","market":"Exchange or market where traded"},
    "pricePerformance": {"dailyRange":"Recent daily price range with volatility assessment","weeklyChange":"Week-over-week percentage change and momentum","volatility":"Volatility regime classification (low/medium/high) based on ATR"},
    "marketCorrelation": "Detailed correlation analysis: how this instrument relates to broader market indices, sector peers, or related assets; include correlation direction and strength",
    "trendQualification": "Trend classification (uptrend/downtrend/rangebound/breakout/consolidation) with specific evidence from price action"
  },

  "technicalAnalysis": {
    "timeframeConvergence": "Multi-timeframe trend convergence analysis across 15min/1H/4H/Daily/Weekly charts; identify where trends align vs diverge and what it means",
    "coreIndicators": {
      "ma": "Moving average analysis: describe MA alignment (golden/death cross), slope, and price position relative to key MAs (20/50/200)",
      "macd": "MACD status: histogram direction, signal line crossover, divergence from price, momentum bias",
      "rsi": "RSI reading with interpretation: overbought (>70)/oversold (<30)/neutral zone, any bullish or bearish divergence detected",
      "boll": "Bollinger Bands position: squeeze vs expansion, price location within bands (upper/middle/lower), mean reversion signals",
      "kdj": "KDJ/Stochastic signal: %K and %D line crossover, overbought/oversold zones, divergence patterns"
    },
    "keyLevels": {
      "strongSupport": "Strong support level with price and reason (e.g., prior swing low + volume cluster)",
      "weakSupport": "Weak/intermediate support level",
      "strongResistance": "Strong resistance level with price and reason (e.g., prior swing high + round number)",
      "weakResistance": "Weak/intermediate resistance level"
    },
    "patternAnalysis": "Chart pattern identification: describe any visible patterns (head & shoulders, double top/bottom, triangles, flags, channels) and their validity/breakout status"
  },

  "fundSentiment": {
    "capitalFlow": "Capital flow analysis: net inflow/outflow direction, institutional vs retail positioning, funding rate implications, any unusual volume spikes",
    "longShortRatio": "Long-to-short ratio: current reading, recent trend (increasing longs/shorts), historical percentile, what it implies about crowd sentiment",
    "positionData": "Position data summary if available: open interest changes, concentration metrics, large holder activity"
  },

  "driversEvents": {
    "currentFactors": [{"type":"positive|negative","factor":"Current market driver with explanation of mechanism and impact on the traded instrument"}],
    "upcomingEvents": [{"date":"Precise date-time in YYYY-MM-DD HH:mm format","event":"Event name with significance level","impact":"Expected market impact and scenario analysis"}]
  },

  "riskAssessment": {
    "level": "high|medium|low",
    "riskFactors": ["List of 3-5 specific risk factors relevant to current positions"],
    "explanation": "Comprehensive risk rationale explaining why this level was assigned, referencing drawdown history, concentration, market conditions"
  },

  "tradingSuggestions": {
    "intraday": {"trendBias":"Intraday trend bias (bullish/bearish/rangebound) with evidence","keyObservation":"Key intraday level or pattern to watch","volatilityNote":"Expected intraday volatility regime and trading implication"},
    "swing": {"trendLogic":"Swing trading trend logic with multi-day timeframe perspective","supportResistanceContext":"Key S/R zones for swing trades","momentumSignal":"Momentum indicator signal for swing timeframe"},
    "midterm": {"trendAssessment":"Midterm (1-4 weeks) trend outlook with fundamental-technical confluence","cyclePhase":"Current market cycle phase (accumulation/markup/distribution)","structuralNotes":"Structural factors affecting midterm view"}
  },

  "categorySpecific": ${categorySpecific},

  "summary": "Overall summary (200-400 words)",
  "tradingPatterns": [{"pattern":"Pattern","frequency":number,"impact":"Impact","examples":[]}],
  "strengths": ["Strengths list"],
  "weaknesses": ["Weaknesses list"],
  "improvementSuggestions": [{"priority":"high|medium|low","suggestion":"Suggestion","expectedImpact":"Expected impact"}],
  "statistics": {"totalTrades":number,"winRate":number,"avgPnL":number,"maxDrawdown":number,"bestPerformingSymbol":"symbol","worstPerformingSymbol":"symbol","timeAnalysis":{}}
}

【Seven Universal Analysis Modules】
Module 1: Asset Overview & Market Context - Basic info, price performance, market correlation, trend qualification
Module 2: Multi-timeframe Technical Analysis - Timeframe convergence, core indicators (MA/MACD/RSI/Bollinger/KDJ), key levels, pattern analysis
Module 3: Fund Flow & Market Sentiment - Capital flow direction and magnitude, long/short sentiment ratio, position data
Module 4: Drivers & Event Calendar - Current positive/negative drivers, upcoming key events in 1-3 days window
Module 5: Risk Assessment - High/medium/low risk grading with probability and impact assessment
Module 6: Multi-period Trend Reference - Intraday, swing, midterm trend analysis and observations (no specific trade signals or price levels)
Module 7: Trading Rules Reminder - Liquidity conditions, typical spreads, active trading session times

【⚠️ Output Length Requirements — STRICTLY ENFORCE MINIMUM LENGTHS】

🚨 ABSOLUTE RULE — ZERO TOLERANCE FOR LAZY OUTPUT 🚨
You are generating a PREMIUM paid analysis report. Every field MUST contain substantial, thoughtful analysis. Violations of these rules produce unusable reports.

FORBIDDEN OUTPUTS (will cause report rejection):
❌ "N/A", "n/a", "NA", "-", "None", "TBD", "null", "undefined", empty string ""
❌ Single number without explanation (e.g., just "$150")
❌ One-word answers (e.g., "bullish", "high", "unknown")
❌ Copying the field name as the value (e.g., dailyRange: "dailyRange")
❌ Any placeholder or filler text

REQUIRED APPROACH — ANALYZE THE TRADE DATA PROVIDED:
You HAVE real trade data with entry prices, exit prices, P&L, quantities, dates, symbols, and directions.
USE THIS DATA to derive meaningful insights. Examples:
- Instead of "dailyRange: N/A" → calculate from actual trade price ranges: "Daily range estimated $X-Y based on observed entry-exit spreads across N trades"
- Instead of "weeklyChange: N/A" → infer from timestamp patterns: "Weekly trajectory shows [up/down/sideways] momentum based on P&L progression across trading days"
- Instead of "volatility: N/A" → compute from data: "Volatility regime assessed as [high/medium/low] — average trade P&L variance indicates X standard deviation"
- Instead of "marketCorrelation: N/A" → reason from symbols traded: "[SYMBOLS] show [positive/negative/mixed] correlation pattern — [explain based on sector exposure or directional clustering]"
- Instead of "RSI/MACD: N/A" → infer from win rate patterns: "Momentum indicators suggest [overbought/oversold/neutral] zone — X% win rate with $Y avg P&L implies [momentum quality]"
- For any field you feel you lack external data → EXPLICITLY STATE your inference method: "Based on available trade data analysis: [your reasoned assessment]"

MINIMUM LENGTH REQUIREMENTS (strictly enforced):
- summary: 250-400 words of comprehensive analysis covering ALL seven modules with specific data references
- quickSnapshot fields: each ≥ 20-40 words with specific price levels derived from trade data
- assetOverview field values: each ≥ 30-50 words with calculations or evidence from provided trades
- technicalAnalysis field values: each ≥ 40-60 words interpreting patterns visible in trade timing/P&L distribution
- fundSentiment field values: each ≥ 30-50 words inferring sentiment from long vs short positioning and sizing patterns
- driversEvents.currentFactors: each factor ≥ 20-40 words connecting macro context to the instruments traded
- driversEvents.upcomingEvents: event ≥ 15 words, impact ≥ 25 words with scenario analysis
- riskAssessment.explanation: 80-150 words with multi-factor reasoning referencing actual drawdown/concentration data
- tradingSuggestions per-period fields: each ≥ 30-50 words with concrete, data-backed recommendations
- categorySpecific field values: each ≥ 40-70 words with category-specific depth
- strengths/weaknesses: each ≥ 12-25 words, provide exactly 5 items each (synthesize if needed)
- improvementSuggestions.suggestion: each ≥ 25-40 words with actionable specifics tied to observed weaknesses

QUALITY GATE: Before outputting, verify EVERY single non-statistics field has ≥15 words of original analysis. If any field falls short, EXPAND IT.`;
  }

  // --- CATEGORY-SPECIFIC PROMPT MODULES ---

  private getCategorySpecificPrompt(assetCategory: AssetCategory, isZh: boolean): string {
    switch (assetCategory) {
      case 'us_stocks':
        return isZh ? this.getUsStocksSpecificZh() : this.getUsStocksSpecificEn();
      case 'forex':
        return isZh ? this.getForexSpecificZh() : this.getForexSpecificEn();
      case 'crypto':
        return isZh ? this.getCryptoSpecificZh() : this.getCryptoSpecificEn();
      default:
        return '{}';
    }
  }

  private getUsStocksSpecificZh(): string {
    return `{
  "usStocks": {
    "fundamentals": "财务基本面分析：营收/净利润/EPS/毛利率/负债率/自由现金流（同比/环比变化）；股票回购/分红/大股东增减持、并购重组、业绩预告",
    "institutionalRating": "机构与评级：投行目标价/评级上调下调、公募/对冲基金持仓变化、机构持仓集中度",
    "industrySector": "行业&板块：赛道景气度/行业政策/板块轮动/竞品对比/领涨领跌板块",
    "optionsData": "期权数据：盘前/盘后价格与流动性、Put/Call比率、行权压力位、与标普500/纳指/道指的联动性",
    "macroDriver": "宏观驱动：美联储利率预期、通胀(CPI/PCE)、非农就业、美债收益率、美元指数走势",
    "specificRisks": ["财报暴雷风险", "小盘股流动性风险", "做空风险", "板块集体回调风险"]
  }
}`;
  }

  private getUsStocksSpecificEn(): string {
    return `{
  "usStocks": {
    "fundamentals": "Fundamental analysis: Revenue/net income/EPS/gross margin/debt ratio/FCF (YoY/QoQ); Share buyback/dividend/insider activity/M&A/earnings guidance",
    "institutionalRating": "Institutional ratings: IB target price/upgrade-downgrade, mutual fund/hedge fund holdings changes, institutional concentration",
    "industrySector": "Industry & Sector: Sector sentiment/industry policy/rotation/competitor comparison/outperformers-underperformers",
    "optionsData": "Options data: Pre/post market liquidity, Put/Call ratio, strike pressure, correlation with S&P500/Nasdaq/Dow",
    "macroDriver": "Macro drivers: Fed rate expectations, inflation (CPI/PCE), non-farm payrolls, Treasury yields, USD index trends",
    "specificRisks": ["Earnings surprise risk", "Small-cap liquidity risk", "Short squeeze risk", "Sector rotation risk"]
  }
}`;
  }

  private getForexSpecificZh(): string {
    return `{
  "forex": {
    "macroComparison": "双国宏观对标：两国央行基准利率对比、加息/降息预期、央行鹰鸽表态、市场干预预期；GDP、通胀、就业、PMI、贸易数据差值对比",
    "currencyAttributes": "品种属性划分：商品货币(澳元/加元/纽元)-联动原油铁矿石黄金等大宗商品；避险货币(日元/瑞郎)-联动全球股市/黄金/地缘风险；直盘/交叉盘-跨币种联动传导效应；贵金属(XAU/XAG等)-联动实际收益率/美元指数/地缘风险/央行购金/通胀预期",
    "sessionCharacteristics": "交易时段特征：亚盘(东京/上海/香港开盘)、欧盘(伦敦盘)、美盘(纽约COMEX)三段行情规律与流动性高峰；数据行情（非农/CPI/利率决议/FOMC）历史波动规律",
    "capitalFlow": "资金流向：全球套息交易流向、美元流动性松紧、外汇储备变化、ETF持仓变动（如SPDR GLD/IAU资金流向）",
    "specificRisks": ["央行突发干预风险", "地缘冲突黑天鹅", "数据大幅偏离预期", "交叉盘异动传导", "流动性枯竭（节假日/亚盘低流动时段）"]
  }
}`;
  }

  private getForexSpecificEn(): string {
    return `{
  "forex": {
    "macroComparison": "Macro comparison: Central bank benchmark rates, hike/cut expectations, hawkish/dovish stance, intervention expectations; GDP/inflation/employment/PMI/trade data differentials",
    "currencyAttributes": "Currency attributes: Commodity currencies (AUD/CAD/NZD)-linked to oil/metals/gold; Safe-haven currencies (CHF/JPY)-linked to equities/gold/geopolitics; Cross-pairs transmission effects; Precious metals (XAU/XAG etc.)-linked to real yields/USD index/geopolitical risk/central bank buying/inflation expectations",
    "sessionCharacteristics": "Session characteristics: Asian (Tokyo/Shanghai/HK open), European (London), US (NY COMEX) session patterns & liquidity peaks; Data event volatility history (NFP/CPI/rate decisions/FOMC)",
    "capitalFlow": "Capital flows: Global carry trade direction, USD liquidity conditions, FX reserve changes, ETF holdings flow (e.g., SPDR GLD/IAU fund flows)",
    "specificRisks": ["Central bank intervention shock", "Geopolitical black swan", "Data surprise deviation", "Cross-pair contagion", "Liquidity drought (holidays/Asian low-flow sessions)"]
  }
}`;
  }

  private getCryptoSpecificZh(): string {
    return `{
  "crypto": {
    "chainData": "链上数据（加密独有基本）：活跃地址数、巨鲸持仓变化、交易所资金净流入/流出；BTC算力、ETH质押量/Gas费、代币解锁、DeFi项目TVL",
    "derivativesData": "衍生品数据（合约为主）：永续合约多空比、全网爆仓金额/方向、资金费率（判断市场冷热）、平均杠杆倍数",
    "regulatorySentiment": "监管&舆情：各国监管政策动态、交易所合规状态、现货ETF/机构准入进展、社群热度、黑客安全、项目方负面/利好",
    "crossMarketLinkage": "跨市场联动：与美股科技股/纳指相关性、美元指数/黄金的价格相关性；主流币(BTC/ETH)对山寨币的带动效应",
    "specificRisks": ["7*24小时无休剧烈波动", "无涨跌停限制风险", "交易所归零/跑路风险", "高杠杆爆仓风险", "交易所流动性风险"]
  }
}`;
  }

  private getCryptoSpecificEn(): string {
    return `{
  "crypto": {
    "chainData": "On-chain data: Active addresses, whale holding changes, exchange net inflows/outflows; BTC hash rate, ETH staking/Gas fees, token unlocks, DeFi TVL",
    "derivativesData": "Derivatives data: Perpetual long/short ratio, global liquidation volume/direction, funding rates (market temperature), average leverage multiples",
    "regulatorySentiment": "Regulation & Sentiment: Global regulatory policies, exchange compliance, spot ETF/institutional adoption progress, community sentiment, hacks/security, project news",
    "crossMarketLinkage": "Cross-market linkage: Correlation with US tech stocks/Nasdaq, USD index/gold price correlation; Major coins (BTC/ETH) leadership effect on altcoins",
    "specificRisks": ["24/7 extreme volatility", "No circuit breaker limits", "Exchange insolvency/run risk", "High leverage liquidation risk", "Exchange liquidity risk"]
  }
}`;
  }

  /** Helper to get asset category key for prompt template */
  private getAssetCategoryKey(): string {
    return 'auto_detect'; // Will be overridden by actual detected value
  }
  async getReportById(userId: string, reportId: string): Promise<AIReportDocument> {
    const collection = await getCollection<AIReportDocument>(MongoCollections.AI_REPORTS);
    const report = await collection.findOne({ reportId, userId });
    if (!report) throw handleNotFoundError('Report');
    return report;
  }

  /**
   * List reports with pagination (8.3)
   */
  async listReports(userId: string, page = 1, limit = 10) {
    const collection = await getCollection<AIReportDocument>(MongoCollections.AI_REPORTS);
    const skip = (page - 1) * limit;
    const [reports, total] = await Promise.all([
      collection.find({ userId }).sort({ generatedAt: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments({ userId }),
    ]);

    return { reports, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Check subscription limits for AI reports (8.4)
   * Tier-based: free=5/month, pro=50/month, prem=100/month
   */
  async checkReportQuota(userId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscriptions: true },
    });
    if (!user) throw new Error('User not found');

    const sub = user.subscriptions.find(s => s.status === 'active');
    const tier = (sub?.tier || 'free') as 'free' | 'pro' | 'prem';

    const TIER_LIMITS: Record<string, number> = { free: 5, pro: 50, prem: 100 };
    const maxReports = TIER_LIMITS[tier] ?? Infinity;

    if (maxReports === Infinity) return { allowed: true, used: 0, limit: -1 };

    const collection = await getCollection<AIReportDocument>(MongoCollections.AI_REPORTS);
    const used = await collection.countDocuments({
      userId,
      generatedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // last 30 days
    });

    return { allowed: used < maxReports, used, limit: maxReports };
  }

  private buildAnalysisContent(
    trades: any[],
    winRate: number,
    avgPnL: number,
    sortedSymbols: [string, { count: number; pnl: number }][],
    totalPnL: number,
    locale: string,
    assetCategory: AssetCategory = 'mixed',
    reportType: 'quick' | 'deep' = 'deep',
    currency = 'USD',
  ): AIReportDocument['content'] {
    const isZh = locale.startsWith('zh');
    const categoryName = getCategoryName(assetCategory, isZh);
    const fmt = (n: number) => formatMoney(n, currency, isZh ? 'zh-CN' : 'en-US');

    // Detect patterns
    const longTrades = trades.filter(t => t.positionDirection === 'long');
    const shortTrades = trades.filter(t => t.positionDirection === 'short');
    const longWinRate = longTrades.length > 0 ? Math.round(longTrades.filter(t => t.pnl > 0).length / longTrades.length * 10000) / 100 : 0;
    const shortWinRate = shortTrades.length > 0 ? Math.round(shortTrades.filter(t => t.pnl > 0).length / shortTrades.length * 10000) / 100 : 0;
    const maxDrawdown = Math.abs(Math.min(...trades.map((t: any) => t.pnl), 0));

    // Determine sentiment based on performance
    const sentiment: 'bullish' | 'bearish' | 'neutral' =
      totalPnL > 0 && winRate >= 50 ? 'bullish'
      : totalPnL < 0 && winRate < 40 ? 'bearish'
      : 'neutral';

    return {
      // V2 fields
      reportType,
      assetCategory,

      quickSnapshot: {
        sentiment,
        keySupport: isZh ? '建议止损位：根据近期低点设定' : 'Stop-loss suggested: Set based on recent lows',
        keyResistance: isZh ? '目标止盈位：根据近期高点设定' : 'Take-profit target: Set based on recent highs',
        shortTermBias: sentiment === 'bullish'
          ? (isZh ? '短期偏多，但需注意风险控制' : 'Short-term bullish, but maintain risk control')
          : sentiment === 'bearish'
            ? (isZh ? '短期偏空，建议减仓观望' : 'Short-term bearish, consider reducing position')
            : (isZh ? '震荡整理中，等待明确方向' : 'Consolidating, wait for clear direction'),
        stopLossHint: isZh
          ? (winRate < 40 ? '胜率偏低，建议收紧止损至2-3%' : '可适当放宽止损至5-8%')
          : (winRate < 40 ? 'Low WR - tighten stop-loss to 2-3%' : 'Can widen stop-loss to 5-8%'),
        coreRisk: isZh
          ? (maxDrawdown > Math.abs(totalPnL) * 2 ? '最大回撤过大，需严格控制仓位' : '整体风险可控')
          : (maxDrawdown > Math.abs(totalPnL) * 2 ? 'Excessive drawdown - strict position control needed' : 'Risk level acceptable'),
      },

      // Deep analysis modules (simplified for fallback)
      ...(reportType === 'deep' ? {
        assetOverview: {
          basicInfo: { name: categoryName, code: assetCategory, market: isZh ? '多品种组合' : 'Multi-asset portfolio' },
          pricePerformance: { dailyRange: 'N/A', weeklyChange: 'N/A', volatility: avgPnL > 0 ? 'Medium' : 'High' },
          marketCorrelation: isZh ? '需结合大盘走势综合判断' : 'Requires correlation with broader market',
          trendQualification: totalPnL > 0 ? 'uptrend' : 'downtrend',
        },

        riskAssessment: {
          level: maxDrawdown > Math.abs(totalPnL) * 2 ? 'high' : winRate < 40 ? 'medium' : 'low',
          riskFactors: [
            ...(winRate < 40 ? [isZh ? '胜率偏低' : 'Below-average win rate'] : []),
            ...(maxDrawdown > Math.abs(totalPnL) ? [isZh ? '回撤幅度较大' : 'Large drawdown magnitude'] : []),
            ...(shortWinRate < 30 && shortTrades.length > 3 ? [isZh ? '空头策略表现差' : 'Weak short performance'] : []),
          ],
          explanation: isZh
            ? `基于${trades.length}笔交易数据分析，当前风险等级为${maxDrawdown > Math.abs(totalPnL) * 2 ? '高' : winRate < 40 ? '中' : '低'}`
            : `Based on ${trades.length} trades analysis, current risk level is ${maxDrawdown > Math.abs(totalPnL) * 2 ? 'high' : winRate < 40 ? 'medium' : 'low'}`,
        },

        tradingSuggestions: {
          unifiedCommand: totalPnL > 0 && winRate >= 50
            ? (isZh ? '加仓做多' : 'add_long')
            : totalPnL > 0 && winRate < 50
              ? (isZh ? '轻仓试多' : 'light_long')
              : (isZh ? '减仓观望' : 'reduce'),
        },
      } : {}),

      // Legacy fields (backward compatible)
      summary: isZh
        ? `[${categoryName}] 共分析 ${trades.length} 笔交易，总盈亏 ${fmt(totalPnL)}，胜率 ${winRate}%，平均每笔 ${fmt(avgPnL)}。${reportType === 'quick' ? '（极速简报模式）' : ''}`
        : `[${categoryName}] Analyzed ${trades.length} trades with total P&L of ${fmt(totalPnL)}, win rate of ${winRate}%, and average P&L of ${fmt(avgPnL)}. ${reportType === 'quick' ? '(Quick snapshot mode)' : ''}`,
      tradingPatterns: [
        ...(longTrades.length > shortTrades.length ? [{
          pattern: isZh ? '偏向多头交易' : 'Bias towards long positions',
          frequency: Math.round(longTrades.length / trades.length * 100),
          impact: isZh ? `多头胜率 ${longWinRate}%` : `Long win rate ${longWinRate}%`,
          examples: longTrades.slice(0, 3).map((t: any) => t.id),
        }] : []),
        ...(sortedSymbols.length > 0 ? [{
          pattern: `${isZh ? '集中交易' : 'Concentrated in'} ${sortedSymbols[0][0]}`,
          frequency: Math.round(sortedSymbols[0][1].count / trades.length * 100),
          impact: `$${sortedSymbols[0][1].pnl.toFixed(2)} P&L`,
          examples: [],
        }] : []),
      ],
      strengths: [
        ...(winRate >= 50 ? [isZh ? '整体胜率良好' : 'Overall positive win rate'] : []),
        ...(longWinRate >= shortWinRate + 10 ? [isZh ? '多头策略表现优于空头' : 'Long strategy outperforms short'] : []),
        ...(avgPnL > 0 ? [isZh ? '平均正收益' : 'Positive average P&L'] : []),
      ].slice(0, 3),
      weaknesses: [
        ...(winRate < 40 ? [isZh ? '胜率偏低需要改进' : 'Below average win rate requires improvement'] : []),
        ...(shortWinRate < 30 && shortTrades.length > 5 ? [isZh ? '空头策略表现不佳' : 'Underperforming in short positions'] : []),
        ...(totalPnL < 0 ? [isZh ? '总体亏损需关注' : 'Overall loss needs attention'] : []),
      ].slice(0, 3),
      improvementSuggestions: [
        { priority: 'high', suggestion: isZh ? '建议减少亏损交易的头寸规模' : 'Consider reducing position sizes on losing trades', expectedImpact: isZh ? '降低最大回撤' : 'Reduce maximum drawdown' },
        { priority: sortedSymbols.length > 0 && sortedSymbols[0][1].pnl < 0 ? 'high' : 'medium',
          suggestion: `${isZh ? '审查' : 'Review'} ${sortedSymbols[0]?.[0] || ''} ${isZh ? '的交易策略' : 'trading strategy'}`,
          expectedImpact: isZh ? '优化品种选择' : 'Optimize instrument selection' },
        { priority: 'low', suggestion: isZh ? '建立更严格的入场/出场规则' : 'Establish stricter entry/exit criteria', expectedImpact: isZh ? '提高一致性' : 'Improve consistency' },
      ],
      statistics: {
        totalTrades: trades.length,
        winRate,
        avgPnL,
        maxDrawdown,
        bestPerformingSymbol: sortedSymbols[0]?.[0] || 'N/A',
        worstPerformingSymbol: sortedSymbols[sortedSymbols.length - 1]?.[0] || 'N/A',
        timeAnalysis: {
          longWinRate, shortWinRate,
          longCount: longTrades.length, shortCount: shortTrades.length,
        },
      },
    };
  }
}

export const aiReportService = new AiReportService();
