import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Button,
  Select, MenuItem, FormControl, InputLabel,
  Grid, Chip, CircularProgress, Divider, List, ListItem, ListItemText,
  Alert, TextField, Paper, IconButton, Fade, Tooltip, Snackbar,
  Checkbox, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, Popover,
} from '@mui/material';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import PaidIcon from '@mui/icons-material/Paid';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import BarChartIcon from '@mui/icons-material/BarChart';
import BoltIcon from '@mui/icons-material/Bolt';
import SendIcon from '@mui/icons-material/Send';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import PsychologyIcon from '@mui/icons-material/Psychology';
import HistoryIcon from '@mui/icons-material/History';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FilterListIcon from '@mui/icons-material/FilterList';
import {
  useGenerateReportMutation, useListReportsQuery, useGetReportQuery,
  useAskQuestionMutation, useCheckQuotaQuery, useListQuestionsQuery,
  type AssetCategory,
} from '../../store/aiReportApi';
import { useGetTradesQuery } from '../../store/tradeApi';
import { useGetCreditBalanceQuery } from '../../store/creditApi';
import { fmtDollar } from '../../utils/format';
import { tokenStorage } from '../../store/authApi';

interface AIModelOption {
  id: string;
  displayName: string;
  provider: string;
  available: boolean;
}

export interface AIReport {
  reportId: string;
  userId: string;
  locale: string;
  aiModel: string;
  generatedAt: string;
  content: {
    summary: string;
    tradingPatterns: Array<{ pattern: string; frequency: number; impact: string; examples: string[] }>;
    strengths: string[];
    weaknesses: string[];
    improvementSuggestions: Array<{ priority: string; suggestion: string; expectedImpact: string }>;
    statistics: { totalTrades: number; winRate: number; avgPnL: number; maxDrawdown: number; bestPerformingSymbol: string; worstPerformingSymbol: string; timeAnalysis?: any };
    // V2 deep analysis fields
    reportType?: string;
    assetCategory?: string;
    quickSnapshot?: { sentiment: string; keySupport: string; keyResistance: string; shortTermBias: string; stopLossHint: string; coreRisk: string };
    assetOverview?: Record<string, any>;
    technicalAnalysis?: Record<string, any>;
    fundSentiment?: Record<string, any>;
    driversEvents?: Record<string, any>;
    riskAssessment?: { level: string; riskFactors: string[]; explanation: string };
    tradingSuggestions?: Record<string, any>;
    categorySpecific?: Record<string, any>;
  };
  metadata: { generationTimeMs: number; tokensUsed: number; dataPointsAnalyzed: number };
  creditsAwarded?: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type ReportStep = 'select' | 'confirm' | 'done';

/** Build contextual smart prompts based on full report data (V1 + V2) */
function buildSmartPrompts(report: AIReport | null, isZh: boolean): string[] {
  if (!report || !report?.content || typeof report.content !== 'object') return [];

  const c = report.content as any;
  const stats = c.statistics;
  const patterns = Array.isArray(c.tradingPatterns) ? c.tradingPatterns : [];
  const assetCat = c.assetCategory;

  // --- Collect all prompt candidates with scores ---
  const candidates: { text: string; score: number }[] = [];
  const add = (text: string, score: number) => { if (text) candidates.push({ text, score }); };

  // === Category-specific prompts (high relevance) ===
  if (assetCat === 'us_stocks') {
    add(isZh ? '报告中的美股基本面分析结论是否与实际走势一致？' : 'Does the US stock fundamental analysis match actual price action?', 9);
    add(isZh ? '机构评级方向和我的持仓方向是否存在冲突？' : 'Any conflict between institutional ratings and my positions?', 8);
  }
  if (assetCat === 'forex') {
    add(isZh ? '报告中提到的央行政策预期对当前仓位有何影响？' : 'How will central bank policy expectations affect my current positions?', 9);
    add(isZh ? '非农数据等宏观事件前后我应该怎么调整策略？' : 'How should I adjust around macro events like NFP?', 8);
  }
  if (assetCat === 'crypto') {
    add(isZh ? '加密市场的链上数据信号是否支持报告中的趋势判断？' : 'Does on-chain data support the trend assessment?', 9);
    add(isZh ? 'BTC波动率变化时，我的山寨币仓位风险有多大？' : 'How exposed are my altcoin positions when BTC vol changes?', 8);
  }
  if (assetCat === 'futures') {
    add(isZh ? '报告中的保证金风险评估是否考虑了极端行情？' : 'Does the margin risk assessment cover extreme scenarios?', 9);
    add(isZh ? '交割月换月期间我需要注意哪些特殊风险？' : 'What special risks during contract rollover?', 8);
  }

  // === V2 Deep Analysis prompts (if available) ===
  if (c.quickSnapshot) {
    const snap = c.quickSnapshot;
    const sentMap: Record<string, { zh: string; en: string }> = {
      bullish: { zh: '报告判断偏多，但我的历史操作中做多胜率并不高，该怎么办？', en: 'Report says bullish but my long-side track record is poor — what should I do?' },
      bearish: { zh: '报告判断偏空，但我习惯性做多，应该如何调整心态？', en: 'Report says bearish but I tend to go long — how to adjust?' },
      neutral: { zh: '报告判断为中性震荡区间，这种行情下我历史上容易犯错吗？', en: 'Neutral/rangebound — do I tend to make mistakes in this environment?' },
    };
    add(sentMap[snap.sentiment]?.[isZh ? 'zh' : 'en'] || '', 10);

    if (snap.coreRisk) {
      add(
        isZh ? `报告中提到的核心风险是"${snap.coreRisk}"，我有办法规避吗？`
          : `Core risk mentioned: "${snap.coreRisk}". Can I mitigate it?`,
        9
      );
    }
    if (snap.keySupport || snap.keyResistance) {
      add(
        isZh ? `关键位支撑${snap.keySupport || '-'}/压力${snap.keyResistance || '-'}，我在这些位置附近的历史成交情况如何？`
          : `Key support ${snap.keySupport || '-'}/resistance ${snap.keyResistance || '-'}. How have I performed near these levels?`,
        8
      );
    }
  }

  if (c.riskAssessment) {
    const riskLevel = c.riskAssessment.level;
    if (riskLevel === 'high') {
      add(isZh ? '报告评估当前风险等级为高，具体应该怎么控制仓位？' : 'High risk level assessed — how should I manage position sizing?', 10);
    }
    if (c.riskAssessment.riskFactors && c.riskAssessment.riskFactors.length > 0) {
      const topRisk = c.riskAssessment.riskFactors[0];
      add(isZh ? `最大风险因子是"${topRisk}"，有没有具体的应对方案？` : `Top risk factor: "${topRisk}". Any specific mitigation plan?`, 8);
    }
  }

  if (c.tradingSuggestions) {
    const ts = c.tradingSuggestions;
    if (ts.intraday?.trendBias) {
      add(
        isZh ? `日内趋势参考显示${ts.intraday.trendBias}，结合我的日内交易记录，这个判断准确吗？`
          : `Intraday bias shows ${ts.intraday.trendBias}. Does this match my intraday record?`,
        7
      );
    }
    if (ts.swing?.trendLogic) {
      add(isZh ? '波段趋势逻辑提到' + String(ts.swing.trendLogic) + '，能否展开说明？' : 'Swing logic mentions ' + String(ts.swing.trendLogic) + '. Please elaborate.', 7);
    }
    if (ts.midterm?.trendAssessment) {
      add(isZh ? `中期趋势综合判断是${ts.midterm.trendAssessment}，对我的持仓周期选择有什么建议？`
          : `Mid-term trend says ${ts.midterm.trendAssessment}. Any suggestions for hold period?`, 7);
    }
  }

  if (c.fundSentiment) {
    add(isZh ? '资金面情绪和技术面走势是否有背离？我该怎么解读？'
      : 'Is there divergence between fund flow sentiment and technicals? How to interpret?', 7);
  }

  if (c.driversEvents?.upcomingEvents && c.driversEvents.upcomingEvents.length > 0) {
    const nextEvent = c.driversEvents.upcomingEvents[0];
    add(
      isZh ? `近期事件"${nextEvent.event}"(${nextEvent.date})可能带来什么影响，我该提前做什么准备？`
        : `Upcoming event "${nextEvent.event}" (${nextEvent.date}) impact? Should I prepare ahead?`,
      8
    );
  }

  if (c.technicalAnalysis?.patternAnalysis) {
    add(isZh ? '技术形态分析提到了哪些具体形态？这些形态在我的交易历史中出现过吗？'
      : 'What chart patterns were identified? Have they appeared in my history?', 6);
  }

  // === Statistics-based prompts (always relevant) ===
  if (stats) {
    // Normalize winRate: if > 1, treat as percentage; otherwise as decimal
    const wrDisplay = stats.winRate != null ? (stats.winRate > 1 ? stats.winRate : stats.winRate * 100) : null;
    
    if (wrDisplay != null) {
      if (wrDisplay < 40) {
        add(isZh ? `胜率只有${wrDisplay.toFixed(1)}%，最有效的提升方式是什么？`
          : `Win rate ${wrDisplay.toFixed(1)}% — most effective improvement path?`, 9);
      } else if (wrDisplay >= 60) {
        add(isZh ? `胜率已达${wrDisplay.toFixed(1)}%，但盈亏比似乎偏低，怎么优化？`
          : `Win rate ${wrDisplay.toFixed(1)}% but R:R seems low — how to optimize?`, 8);
      }
    }
    if (stats.maxDrawdown > 0 && stats.totalTrades > 5) {
      const ddPct = ((stats.maxDrawdown / (Math.abs(stats.avgPnL) || 1))).toFixed(1);
      add(isZh ? `最大回撤${stats.maxDrawdown}相当于平均盈利的约${ddPct}倍，风控是否到位？`
        : `Max drawdown ${stats.maxDrawdown} ≈ ${ddPct}x avg profit. Is risk control adequate?`, 8);
    }
    if (stats.bestPerformingSymbol) {
      add(isZh ? `${stats.bestPerformingSymbol}是我最好的品种，能不能分析一下为什么？`
        : `${stats.bestPerformingSymbol} is my best performer — why exactly?`, 7);
    }
    if (stats.worstPerformingSymbol) {
      add(isZh ? `${stats.worstPerformingSymbol}亏得最多，是不是应该避开这个品种？`
        : `${stats.worstPerformingSymbol} is worst — should I avoid it entirely?`, 7);
    }
  }

  // === Pattern-based prompts ===
  const patternNames = patterns.map((p: any) => p.pattern).filter(Boolean);
  if (patternNames.includes('over_trading') || patternNames.includes('过度交易')) {
    add(isZh ? '报告指出我存在过度交易的问题，有什么具体的克制方法？'
      : 'Report flags over-trading. Any practical ways to curb it?', 9);
  }
  if (patternNames.includes('premature_take_profit') || patternNames.includes('过早止盈')) {
    add(isZh ? '我经常过早止盈，有没有量化标准来判断最佳出场点？'
      : 'I take profits too early — any quantified criteria for optimal exit?', 9);
  }
  if (patternNames.includes('stop_loss_violation') || patternNames.includes('止损不严')) {
    add(isZh ? '止损纪律是我最大的弱点，如何从系统层面强制改善？'
      : 'Stop-loss discipline is my weakest link — systematic improvement approach?', 9);
  }

  // === Generic fallback prompts (low score, shown only when nothing better) ===
  if (candidates.length < 6) {
    add(isZh ? '这份报告的核心结论用一句话总结？' : 'Summarize the core conclusion in one sentence.', 3);
    add(isZh ? '根据这份报告，我现在最应该改变的一个交易习惯是什么？'
      : 'Based on this report, what ONE habit should I change most?', 4);
    add(isZh ? '给我一个可执行的本周改进计划' : 'Give me an actionable improvement plan for this week', 3);
  }

  // Sort by score desc, deduplicate by similarity, limit to 12
  candidates.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const c of candidates) {
    if (!seen.has(c.text) && result.length < 12) {
      seen.add(c.text);
      result.push(c.text);
    }
  }
  return result;
}

export default function AiReportsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isZh = i18n.language.startsWith('zh');
  const [model, setModel] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<AIModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [historyAnchorEl, setHistoryAnchorEl] = useState<HTMLElement | null>(null);

  // V2: Asset category and report type state
  const [assetCategory, setAssetCategory] = useState<AssetCategory>('forex');
  const [reportType, setReportType] = useState<'quick' | 'deep'>('deep');

  // Trade selection state
  const [reportStep, setReportStep] = useState<ReportStep>('select');
  const [selectedTradeIds, setSelectedTradeIds] = useState<Set<string>>(new Set());
  // Filter state
  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterDirection, setFilterDirection] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<Date | null>(null);
  const [filterEndDate, setFilterEndDate] = useState<Date | null>(null);

  // Follow-up question state
  const [questionInput, setQuestionInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // History panel state
  const [showHistory, setShowHistory] = useState(false);
  const [expandedQId, setExpandedQId] = useState<string | null>(null);

  // PDF export
  const [exportingPdf, setExportingPdf] = useState(false);
  const [creditToast, setCreditToast] = useState('');
  const reportDetailRef = useRef<HTMLDivElement>(null);

  const { data: reportsData, isLoading: listLoading } = useListReportsQuery(undefined);
  const [generateReport, { isLoading: generating }] = useGenerateReportMutation();
  const { data: selectedReport } = useGetReportQuery(selectedReportId!, { skip: !selectedReportId });
  const [askQuestion, { isLoading: asking }] = useAskQuestionMutation();
  const { data: quotaData } = useCheckQuotaQuery(undefined);
  const { data: questionsData, isLoading: questionsLoading } = useListQuestionsQuery({ page: 1, limit: 50 });
  const { data: creditBalance } = useGetCreditBalanceQuery({} as any);
  const balanceData = creditBalance?.data || creditBalance || {};
  const availableCredits = balanceData?.available || 0;

  // Credit confirmation dialog state
  interface CreditConfirmAction {
    type: 'report' | 'followup';
    cost: number;
    onConfirm: () => void;
  }
  const [creditConfirmAction, setCreditConfirmAction] = useState<CreditConfirmAction | null>(null);

  // Detect current user tier
  const currentUser = tokenStorage.getUser();
  const userTier = (currentUser?.tier || 'free') as 'free' | 'pro' | 'prem';
  const isFreeUser = userTier === 'free';

  // Fetch trades for selection (with filters)
  const { data: tradesData, isLoading: tradesLoading } = useGetTradesQuery({
    ...(filterSymbol && { symbol: filterSymbol }),
    ...(filterDirection && { direction: filterDirection as 'long' | 'short' }),
    ...(filterStartDate && { startDate: filterStartDate.toISOString().slice(0, 10) }),
    ...(filterEndDate && { endDate: filterEndDate.toISOString().slice(0, 10) }),
    limit: 500,
  });

  const reports = reportsData?.reports || [];
  const allTrades = tradesData?.trades || [];
  const smartPrompts = buildSmartPrompts(selectedReport ?? null, isZh);
  const hasFilter = !!(filterSymbol || filterDirection || filterStartDate || filterEndDate);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    const fetchModels = async () => {
      setModelsLoading(true);
      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch('/api/v1/ai/models', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success && Array.isArray(result.data)) {
            const models: AIModelOption[] = result.data;
            setAvailableModels(models);
            // Auto-select first available model
            const firstAvailable = models.find(m => m.available) || models[0];
            if (firstAvailable && !model) {
              setModel(firstAvailable.id);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
      } finally {
        setModelsLoading(false);
      }
    };
    fetchModels();
  }, [model]);

  useEffect(() => {
    const firstAvailable = availableModels.find(m => m.available);
    if (firstAvailable && !availableModels.find(m => m.id === model)?.available) {
      setModel(firstAvailable.id);
    }
  }, [availableModels]);

  // Clear selected trades when filters change
  useEffect(() => {
    setSelectedTradeIds(new Set());
  }, [filterSymbol, filterDirection, filterStartDate, filterEndDate]);

  const providerLabels: Record<string, string> = {
    openai: t('aiReports.providers.openai'),
    anthropic: t('aiReports.providers.anthropic'),
    google: t('aiReports.providers.google'),
  };

  // Map ofox internal models to their logical native provider for UI display
  const displayProvider = (modelId: string, rawProvider: string): string => {
    if (rawProvider === 'ofox') {
      if (modelId.startsWith('gpt')) return 'openai';
      if (modelId.startsWith('claude')) return 'anthropic';
      if (modelId.startsWith('gemini')) return 'google';
    }
    return rawProvider;
  };

  const handleAskQuestion = async (question: string, skipCreditCheck = false) => {
    if (!question.trim() || !selectedReportId || asking) return;

    if (!skipCreditCheck) {
      // For follow-up, always call API first; on 402 we'll show credit confirm
      return doAskQuestion(question);
    }
    return doAskQuestion(question);
  };

  const doAskQuestion = async (question: string, confirmCreditPayment = false) => {
    if (!question.trim() || !selectedReportId || asking) return;

    const userMsg: ChatMessage = { role: 'user', content: question, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMsg]);
    setQuestionInput('');

    try {
      const result = await askQuestion({
        reportId: selectedReportId,
        question,
        locale: i18n.language,
        confirmCreditPayment,
      }).unwrap();

      if (result.creditsAwarded && result.creditsAwarded > 0) {
        setCreditToast(isZh ? `+${result.creditsAwarded} 积分已到账！` : `+${result.creditsAwarded} credits earned!`);
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: result.answer,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const status = err?.status;
      const code = err?.data?.code;

      if (status === 403 && code === 'UPGRADE_REQUIRED_FOR_CHAT') {
        // Remove the pending user message and show upgrade message
        setChatMessages(prev => prev.slice(0, -1));
        setQuestionInput(question);
        const errorMsg = isZh
          ? 'AI 追问功能需要 Pro 或 Premium 版本。免费用户可以生成 AI 报告，但无法使用追问功能。请升级您的套餐。'
          : 'AI follow-up requires Pro or Premium plan. Free users can generate reports but cannot ask follow-up questions. Please upgrade.';
        const errorChatMsg: ChatMessage = { role: 'assistant', content: errorMsg, timestamp: new Date() };
        setChatMessages(prev => [...prev, errorChatMsg]);
      } else if (status === 402 && code === 'CREDIT_PAYMENT_REQUIRED') {
        // Phase 1: Quota exhausted, need user to confirm credit payment
        setChatMessages(prev => prev.slice(0, -1));
        setQuestionInput(question);
        const cost = err?.data?.creditCost || 50;
        setCreditConfirmAction({
          type: 'followup',
          cost,
          onConfirm: () => {
            setCreditConfirmAction(null);
            doAskQuestion(question, true); // Phase 2: retry with confirmation
          },
        });
      } else if (status === 402 && code === 'INSUFFICIENT_CREDITS') {
        // Not enough credits — show error dialog
        setChatMessages(prev => prev.slice(0, -1));
        setQuestionInput(question);
        const cost = err?.data?.creditCost || 50;
        setCreditConfirmAction({
          type: 'followup',
          cost,
          onConfirm: () => {}, // disabled by insufficient balance
        });
      } else {
        // Other errors → show generic error
        const errorMsg = isZh
          ? '抱歉，AI 暂时无法回答，请稍后重试。'
          : 'Sorry, AI is temporarily unavailable. Please try again later.';
        const errorChatMsg: ChatMessage = { role: 'assistant', content: errorMsg, timestamp: new Date() };
        setChatMessages(prev => [...prev, errorChatMsg]);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskQuestion(questionInput);
    }
  };

  // Toggle trade selection
  const toggleTradeSelection = (tradeId: string) => {
    setSelectedTradeIds(prev => {
      const next = new Set(prev);
      if (next.has(tradeId)) next.delete(tradeId); else next.add(tradeId);
      return next;
    });
  };

  // Select/deselect all filtered trades
  const toggleSelectAll = () => {
    if (selectedTradeIds.size === allTrades.length && allTrades.length > 0) {
      setSelectedTradeIds(new Set());
    } else {
      setSelectedTradeIds(new Set(allTrades.map((t: any) => t.id)));
    }
  };

  // Step 1 -> 2: Proceed to confirmation
  const proceedToConfirm = () => {
    if (selectedTradeIds.size === 0) return;
    setReportStep('confirm');
  };

  // Step 2: Confirm and generate report (two-phase credit confirmation)
  const handleConfirmGenerate = async (confirmCreditPayment = false) => {
    try {
      const result = await generateReport({
        aiModel: model,
        locale: i18n.language,
        reportType,          // V2: quick or deep
        assetCategory: assetCategory,  // V2: user-specified category (auto removed)
        tradeIds: Array.from(selectedTradeIds),
        confirmCreditPayment,
      }).unwrap();

      if (result.creditsAwarded && result.creditsAwarded > 0) {
        setCreditToast(isZh ? `+${result.creditsAwarded} 积分已到账！` : `+${result.creditsAwarded} credits earned!`);
      }

      setReportStep('done');
      setSelectedReportId(result.reportId);
      setSelectedTradeIds(new Set());
      setReportStep('select');
    } catch (err: any) {
      console.error('Generate report failed:', err);
      const status = err?.status;
      const code = err?.data?.code;

      if (status === 402 && code === 'CREDIT_PAYMENT_REQUIRED') {
        // Phase 1: Quota exhausted, need user to confirm credit payment
        const cost = err?.data?.creditCost || 100;
        setCreditConfirmAction({
          type: 'report',
          cost,
          onConfirm: () => { setCreditConfirmAction(null); handleConfirmGenerate(true); },
        });
      } else if (status === 402 && code === 'INSUFFICIENT_CREDITS') {
        // Not enough credits — show error dialog
        const cost = err?.data?.creditCost || 100;
        setCreditConfirmAction({
          type: 'report',
          cost,
          onConfirm: () => {}, // disabled by insufficient balance
        });
      } else {
        // Network error / server down / other failures — show user-friendly message
        const msg = !navigator.onLine
          ? (isZh ? '网络连接已断开，请检查网络' : 'Network offline, please check connection')
          : (err?.message || err?.data?.message || (isZh ? '报告生成失败，请稍后重试' : 'Failed to generate report, please try again'));
        setCreditToast(`⚠️ ${msg}`);
      }
    }
  };

  // Cancel selection flow
  const cancelGeneration = () => {
    setReportStep('select');
    setSelectedTradeIds(new Set());
  };

  /* Export report as PDF */
  const handleExportPdf = async () => {
    if (!reportDetailRef.current || !selectedReport || exportingPdf) return;
    setExportingPdf(true);
    try {
      const canvas = await html2canvas(reportDetailRef.current, { scale: 2, useCORS: true, backgroundColor: '#0d1117' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 16;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 8;
      pdf.addImage(imgData, 'PNG', 8, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 16;
      while (heightLeft > 0) {
        position -= pageHeight - 16;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 8, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - 16;
      }
      const dateStr = new Date(selectedReport.generatedAt).toISOString().slice(0, 10);
      pdf.save(`TradeAnchor_AI_Report_${dateStr}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mt: 4, mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">
            <span style={{ fontSize: '1.3em', marginRight: '4px', verticalAlign: 'middle' }}>🧠</span>
            {t('aiReports.title')}
          </Typography>
          <Chip label={`${availableModels.filter(m => m.available).length} ${t('aiReports.modelsAvailable')}`} color="primary" size="small" />
        </Box>

        {/* Generate Report Card */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Typography variant="h6" gutterBottom>{t('aiReports.generateNew')}</Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<HistoryIcon fontSize="small" />}
                onClick={(e) => setHistoryAnchorEl(e.currentTarget)}
                sx={{ mt: -0.5, textTransform: 'none', fontSize: '0.8rem', minWidth: 100 }}
              >
                {t('aiReports.previousReports')}
                {reports.length > 0 && (
                  <Chip size="small" label={reports.length} color="primary" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.4 } }} />
                )}
              </Button>
            </Box>

            {/* Step indicator */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              {(['select', 'confirm'] as const).map((step, idx) => (
                <Chip
                  key={step}
                  icon={<span style={{ fontSize: 14 }}>{idx + 1}</span>}
                  label={
                    step === 'select'
                      ? t('aiReports.selectTrades')
                      : t('aiReports.confirmSelection')
                  }
                  color={reportStep === step ? 'primary' : 'default'}
                  variant={reportStep === step || (step === 'confirm' && reportStep === 'done') ? 'filled' : 'outlined'}
                  size="small"
                />
              ))}
            </Box>

            {reportStep === 'select' && (
              <>
                {/* AI Model + Filters Row */}
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
                  <FormControl size="small" sx={{ minWidth: 200 }} disabled={modelsLoading}>
                    <InputLabel>{t('aiReports.selectModel')}</InputLabel>
                    <Select value={model} label={t('aiReports.selectModel')} onChange={e => setModel(e.target.value)}>
                      {[...availableModels]
                        .sort((a, b) => {
                          const pa = displayProvider(a.id, a.provider);
                          const pb = displayProvider(b.id, b.provider);
                          const order = ['openai', 'anthropic', 'google'];
                          return (order.indexOf(pa) ?? 99) - (order.indexOf(pb) ?? 99);
                        })
                        .map(m => {
                          const dp = displayProvider(m.id, m.provider);
                          return (
                            <MenuItem key={m.id} value={m.id} disabled={!m.available}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>{m.displayName}</Typography>
                                <Chip
                                  label={providerLabels[dp] || dp}
                                  size="small"
                                  color={dp === 'openai' ? 'success' : dp === 'anthropic' ? 'warning' : 'info'}
                                  sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                              </Box>
                            </MenuItem>
                          );
                        })}
                    </Select>
                  </FormControl>

                  {/* V2: Asset Category Selector */}
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>{isZh ? '分析品类' : 'Asset Category'}</InputLabel>
                    <Select value={assetCategory} label={isZh ? '分析品类' : 'Asset Category'} onChange={e => setAssetCategory(e.target.value as AssetCategory)}>
                      <MenuItem value="us_stocks">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TrendingUpIcon sx={{ color: '#00d4aa', fontSize: 20 }} /> {isZh ? '美股' : 'US Stocks'}
                        </Box>
                      </MenuItem>
                      <MenuItem value="forex">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <SyncAltIcon sx={{ color: '#60a5fa', fontSize: 20 }} /> {isZh ? '外汇' : 'Forex'}
                        </Box>
                      </MenuItem>
                      <MenuItem value="crypto">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PaidIcon sx={{ color: '#fbbf24', fontSize: 20 }} /> {isZh ? '加密货币' : 'Crypto'}
                        </Box>
                      </MenuItem>
                      <MenuItem value="futures">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ShowChartIcon sx={{ color: '#a78bfa', fontSize: 20 }} /> {isZh ? '期货' : 'Futures'}
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>

                  {/* V2: Report Type Selector */}
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>{isZh ? '报告类型' : 'Report Type'}</InputLabel>
                    <Select value={reportType} label={isZh ? '报告类型' : 'Report Type'} onChange={e => setReportType(e.target.value as 'quick' | 'deep')}>
                      <MenuItem value="deep">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <BarChartIcon sx={{ color: '#f59e0b', fontSize: 20 }} /> {isZh ? '深度分析报告' : 'Deep Analysis'}
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            ({isZh ? '全维度' : 'Full modules'})
                          </Typography>
                        </Box>
                      </MenuItem>
                      <MenuItem value="quick">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <BoltIcon sx={{ color: '#fbbf24', fontSize: 20 }} /> {isZh ? '极速简报' : 'Quick Snapshot'}
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            ({isZh ? '100-300字' : '100-300 words'})
                          </Typography>
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>

                  {/* Trade Filters */}
                  <TextField
                    size="small"
                    label={t('trades.symbol')}
                    value={filterSymbol}
                    onChange={(e) => setFilterSymbol(e.target.value)}
                    sx={{ minWidth: 120 }}
                  />
                  <FormControl size="small" sx={{ minWidth: 110 }}>
                    <InputLabel>{t('trades.direction')}</InputLabel>
                    <Select value={filterDirection} label={t('trades.direction')} onChange={e => setFilterDirection(e.target.value)}>
                      <MenuItem value="">{t('common.all')}</MenuItem>
                      <MenuItem value="long">{t('trades.long')}</MenuItem>
                      <MenuItem value="short">{t('trades.short')}</MenuItem>
                    </Select>
                  </FormControl>
                  <DatePicker
                    label={t('trades.filters.startDate')}
                    value={filterStartDate}
                    onChange={(val) => { setFilterStartDate(val); }}
                    slotProps={{ textField: { size: 'small', sx: { width: 160 } } }}
                    format="yyyy/MM/dd"
                  />
                  <DatePicker
                    label={t('trades.filters.endDate')}
                    value={filterEndDate}
                    onChange={(val) => { setFilterEndDate(val); }}
                    slotProps={{ textField: { size: 'small', sx: { width: 160 } } }}
                    format="yyyy/MM/dd"
                  />

                  {modelsLoading && <CircularProgress size={20} />}
                </Box>

                {/* Trades Selection Table */}
                <Box sx={{ mt: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FilterListIcon fontSize="small" />
                      {t('aiReports.tradeTableTitle')}
                      <Chip size="small" label={`${allTrades.length} ${t('common.rows')}`} variant="outlined" />
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {selectedTradeIds.size > 0 && (
                        <Chip
                          size="small"
                          color="primary"
                          label={`${t('aiReports.selectedCount', { count: selectedTradeIds.size })}`}
                          onDelete={() => setSelectedTradeIds(new Set())}
                        />
                      )}
                      <Button
                        size="small"
                        onClick={toggleSelectAll}
                        disabled={allTrades.length === 0}
                      >
                        {selectedTradeIds.size === allTrades.length && allTrades.length > 0
                          ? t('aiReports.deselectAll')
                          : t('aiReports.selectAll')}
                      </Button>
                    </Box>
                  </Box>

                  {tradesLoading ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box>
                  ) : !hasFilter ? (
                    <Paper
                      variant="outlined"
                      sx={{ p: 6, textAlign: 'center', borderRadius: 2, borderStyle: 'dashed', borderColor: 'divider' }}
                    >
                      <FilterListIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                      <Typography variant="body1" sx={{ color: 'text.secondary', mb: 0.5 }}>
                        {isZh ? '请先设置筛选条件，查看交易记录明细' : 'Set filters above to view trade records'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        {isZh ? '支持按代码、方向、日期范围筛选' : 'Filter by symbol, direction, or date range'}
                      </Typography>
                    </Paper>
                  ) : allTrades.length === 0 ? (
                    <Alert severity="info">{t('aiReports.noTradesForSelection')}</Alert>
                  ) : (
                    <TableContainer sx={{ maxHeight: 360, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell padding="checkbox" sx={{ fontWeight: 700, bgcolor: 'action.hover', color: 'text.primary' }}>
                              <Checkbox
                                indeterminate={selectedTradeIds.size > 0 && selectedTradeIds.size < allTrades.length}
                                checked={allTrades.length > 0 && selectedTradeIds.size === allTrades.length}
                                onChange={toggleSelectAll}
                                size="small"
                              />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover', color: 'text.primary' }}>{t('trades.symbol')}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, bgcolor: 'action.hover', color: 'text.primary' }}>{t('trades.dir')}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, bgcolor: 'action.hover', color: 'text.primary' }}>{t('trades.entry')}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, bgcolor: 'action.hover', color: 'text.primary' }}>{t('trades.exit')}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, bgcolor: 'action.hover', color: 'text.primary' }}>{t('trades.qty')}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, bgcolor: 'action.hover', color: 'text.primary' }}>{t('trades.pnl')}</TableCell>
                            <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover', color: 'text.primary' }}>{t('trades.date')}</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(allTrades as any[]).map((trade) => {
                            const isSelected = selectedTradeIds.has(trade.id);
                            return (
                              <TableRow
                                key={trade.id}
                                hover
                                onClick={() => toggleTradeSelection(trade.id)}
                                sx={{
                                  cursor: 'pointer',
                                  backgroundColor: isSelected ? 'rgba(25,118,210,0.08)' : 'inherit',
                                  '&:hover': { backgroundColor: isSelected ? 'rgba(25,118,210,0.12)' : 'rgba(0,0,0,0.04)' },
                                }}
                              >
                                <TableCell padding="checkbox">
                                  <Checkbox checked={isSelected} size="small" />
                                </TableCell>
                                <TableCell sx={{ fontWeight: 500 }}>{trade.tradingSymbol}</TableCell>
                                <TableCell align="right">
                                  <Chip
                                    label={trade.positionDirection === 'long' ? t('trades.long') : t('trades.short')}
                                    size="small"
                                    color={trade.positionDirection === 'long' ? 'success' : 'warning'}
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell align="right">{fmtDollar(trade.entryPrice)}</TableCell>
                                <TableCell align="right">{trade.exitPrice ? fmtDollar(trade.exitPrice) : '-'}</TableCell>
                                <TableCell align="right">{trade.quantity}</TableCell>
                                <TableCell align="right">
                                  <Typography sx={{ fontWeight: 600, color: (trade.pnl ?? 0) >= 0 ? 'success.main' : 'error.main' }}>
                                    {fmtSignedCurrency(trade.pnl ?? 0)}
                                  </Typography>
                                </TableCell>
                                <TableCell>{new Date(trade.entryTimestamp).toLocaleDateString()}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  {/* Action buttons */}
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <Button
                      variant="contained"
                      startIcon={<AnalyticsIcon />}
                      onClick={proceedToConfirm}
                      disabled={selectedTradeIds.size === 0 || generating}
                    >
                      {t('aiReports.nextConfirm')}
                    </Button>
                  </Box>
                </Box>
              </>
            )}

            {/* Confirmation Step */}
            {reportStep === 'confirm' && (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <CheckCircleIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>{t('aiReports.confirmTitle')}</Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                  {t('aiReports.confirmDescription', {
                    count: selectedTradeIds.size,
                    model: availableModels.find(m => m.id === model)?.displayName || model,
                  })}
                </Typography>
                {/* Confirm note removed */}
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                  <Button variant="outlined" onClick={cancelGeneration}>
                    {t('common.back')}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={generating ? <CircularProgress size={16} sx={{ mr: 1, color: 'white' }} /> : undefined}
                    onClick={() => handleConfirmGenerate()}
                    disabled={generating}
                  >
                    {generating
                      ? t('aiReports.generating')
                      : t('aiReports.generateWith', { model: availableModels.find(m => m.id === model)?.displayName || model })}
                  </Button>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* History Reports Popover */}
        <Popover
          open={Boolean(historyAnchorEl)}
          anchorEl={historyAnchorEl}
          onClose={() => setHistoryAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          sx={{
            '& .MuiPaper-root': {
              width: 460,
              maxHeight: 420,
              backgroundImage: 'none',
              bgcolor: 'background.paper',
            },
          }}
        >
          <Box sx={{ p: 1, pb: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5, mb: 0.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.primary' }}>
                {t('aiReports.previousReports')}
              </Typography>
              <Chip size="small" label={`${reports.length} ${isZh ? '份' : ''}`} color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.68rem' }} />
            </Box>
            {listLoading ? (
              <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={24} /></Box>
            ) : !reports.length ? (
              <Alert severity="info" sx={{ py: 0 }}>{t('aiReports.noReports')}</Alert>
            ) : (
              <List dense disablePadding sx={{ '&::-webkit-scrollbar': { width: 5 }, '&::-webkit-scrollbar-thumb': { borderRadius: 3, bgcolor: 'rgba(255,255,255,0.12)' } }}>
                {reports.map((r: AIReport) => (
                  <ListItem
                    key={r.reportId}
                    component="div"
                    dense
                    onClick={() => { setSelectedReportId(r.reportId); setChatMessages([]); setHistoryAnchorEl(null); }}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: 1,
                      mx: 0.25,
                      mb: 0.2,
                      backgroundColor: selectedReportId === r.reportId ? 'rgba(25,118,210,0.14)' : 'transparent',
                      '&:hover': { backgroundColor: selectedReportId === r.reportId ? 'rgba(25,118,210,0.18)' : 'rgba(255,255,255,0.06)' },
                      borderLeft: selectedReportId === r.reportId ? '3px solid primary.main' : '3px solid transparent',
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ fontWeight: selectedReportId === r.reportId ? 600 : 400, fontSize: '0.8rem' }}>
                            {new Date(r.generatedAt).toLocaleDateString()}
                          </Typography>
                          <Chip size="small" label={r.aiModel} variant="outlined" sx={{ height: 20, fontSize: '0.68rem' }} />
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {r.content.statistics.totalTrades} {t('trades.title')} | {r.content.summary.slice(0, 50)}...
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Popover>

        {/* Main Content: Report Detail + AI Follow-up */}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            {selectedReport ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Report Detail Card */}
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">
                        <AnalyticsIcon sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                        {t('aiReports.reportDetail')}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={selectedReport.aiModel} color="primary" size="small" />
                        {/* V2: Show asset category and report type */}
                        {selectedReport.content.assetCategory && (
                          <Chip
                            size="small"
                            variant="outlined"
                            color="secondary"
                            icon={selectedReport.content.assetCategory === 'us_stocks'
                              ? <TrendingUpIcon sx={{ color: '#00d4aa', fontSize: 16 }} />
                              : selectedReport.content.assetCategory === 'forex'
                                ? <SyncAltIcon sx={{ color: '#60a5fa', fontSize: 16 }} />
                                : selectedReport.content.assetCategory === 'crypto'
                                  ? <PaidIcon sx={{ color: '#fbbf24', fontSize: 16 }} />
                                  : selectedReport.content.assetCategory === 'futures'
                                    ? <ShowChartIcon sx={{ color: '#a78bfa', fontSize: 16 }} />
                                    : undefined}
                            label={`${{
                              us_stocks: isZh ? '美股' : 'US Stocks',
                              forex: isZh ? '外汇' : 'Forex',
                              crypto: isZh ? '加密货币' : 'Crypto',
                              futures: isZh ? '期货' : 'Futures',
                              mixed: isZh ? '混合' : 'Mixed',
                            }[selectedReport.content.assetCategory] || selectedReport.content.assetCategory}`}
                          />
                        )}
                        {selectedReport.content.reportType && (
                          <Chip
                            size="small"
                            variant="outlined"
                            color={selectedReport.content.reportType === 'quick' ? 'success' : 'info'}
                            icon={selectedReport.content.reportType === 'quick'
                              ? <BoltIcon sx={{ color: '#fbbf24', fontSize: 16 }} />
                              : <BarChartIcon sx={{ color: '#f59e0b', fontSize: 16 }} />}
                            label={selectedReport.content.reportType === 'quick'
                              ? (isZh ? '极速简报' : 'Quick')
                              : (isZh ? '深度分析' : 'Deep')
                            }
                          />
                        )}
                        <Tooltip title={isZh ? '下载 PDF 报告' : 'Download Report as PDF'}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={exportingPdf ? <CircularProgress size={14} /> : undefined}
                            onClick={handleExportPdf}
                            disabled={exportingPdf}
                            sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                          >
                            {isZh ? 'PDF' : 'PDF'}
                          </Button>
                        </Tooltip>
                      </Box>
                    </Box>

                    <div ref={reportDetailRef}>

                    {selectedReport?.content?.summary && (<Alert severity="info" sx={{ mb: 2 }}>{selectedReport.content.summary}</Alert>)}

                    {selectedReport?.content?.statistics && (
                    <Grid container spacing={1} sx={{ mb: 2 }}>
                      {[
                        [t('aiReports.reportTrades'), selectedReport.content.statistics.totalTrades],
                        [t('aiReports.reportWinRate'), `${selectedReport.content.statistics.winRate}%`],
                        [t('aiReports.reportAvgPnl'), fmtDollar(selectedReport.content.statistics.avgPnL)],
                        [t('aiReports.reportMaxDd'), fmtDollar(selectedReport.content.statistics.maxDrawdown)],
                        [t('aiReports.reportBest'), selectedReport.content.statistics.bestPerformingSymbol],
                        [t('aiReports.reportWorst'), selectedReport.content.statistics.worstPerformingSymbol],
                      ].map(([label, val]) => (
                        <Grid size={{ xs: 6 }} key={String(label)}>
                          <Box sx={{ p: 1.5, bgcolor: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,215,0,0.15)', borderRadius: 1.5, textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ color: '#E5A23C', fontWeight: 500, letterSpacing: 0.5 }}>{label}</Typography>
                            <Typography sx={{ fontWeight: 700, color: '#FFD700', fontSize: '1rem' }}>{val}</Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                    )}

                    {selectedReport?.content?.strengths && selectedReport?.content?.weaknesses && (
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 700 }}>{t('aiReports.strengths')}</Typography>
                        {selectedReport.content.strengths.length ? (
                          <List dense>{selectedReport.content.strengths.map((s, i) => (
                            <ListItem key={i}>
                              <ListItemText primary={`+ ${s}`} slotProps={{
                                primary: { sx: { color: '#f9a8d4', fontWeight: 600 } },
                              }} />
                            </ListItem>
                          ))}</List>
                        ) : (
                          <Typography variant="caption" sx={{ color: '#f9a8d4', fontWeight: 600 }}>{t('aiReports.noneDetected')}</Typography>
                        )}
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 700 }}>{t('aiReports.weaknesses')}</Typography>
                        {selectedReport.content.weaknesses.length ? (
                          <List dense>{selectedReport.content.weaknesses.map((w, i) => (
                            <ListItem key={i}>
                              <ListItemText primary={`- ${w}`} slotProps={{
                                primary: { sx: { color: '#93c5fd', fontWeight: 600 } },
                              }} />
                            </ListItem>
                          ))}</List>
                        ) : (
                          <Typography variant="caption" sx={{ color: '#93c5fd', fontWeight: 600 }}>{t('aiReports.noneDetected')}</Typography>
                        )}
                      </Grid>
                    </Grid>
                    )}

                    {/* ========== V2: Deep Analysis Modules ========== */}
                    {selectedReport?.content?.quickSnapshot && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                          <Chip
                            size="small"
                            color={
                              selectedReport.content.quickSnapshot.sentiment === 'bullish' ? 'success'
                              : selectedReport.content.quickSnapshot.sentiment === 'bearish' ? 'error' : 'warning'
                            }
                            label={{
                              bullish: isZh ? '🟢 看多' : '🟢 Bullish',
                              bearish: isZh ? '🔴 看空' : '🔴 Bearish',
                              neutral: isZh ? '🟡 中性' : '🟡 Neutral',
                            }[selectedReport.content.quickSnapshot.sentiment]}
                          />
                          <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                            {isZh ? '行情快照' : 'Market Snapshot'}
                          </Typography>
                        </Box>
                        <Grid container spacing={1} sx={{ mb: 1 }}>
                          {[
                            [isZh ? '关键支撑' : 'Key Support', selectedReport.content.quickSnapshot.keySupport],
                            [isZh ? '关键压力' : 'Key Resistance', selectedReport.content.quickSnapshot.keyResistance],
                            [isZh ? '短期偏向' : 'Short-term Bias', selectedReport.content.quickSnapshot.shortTermBias],
                            [isZh ? '止损提示' : 'Stop-loss Hint', selectedReport.content.quickSnapshot.stopLossHint],
                            [isZh ? '核心风险' : 'Core Risk', selectedReport.content.quickSnapshot.coreRisk],
                          ].map(([label, val]) => (
                            <Grid size={{ xs: 12 }} key={String(label)}>
                              <Box sx={{ p: 1.2, bgcolor: 'rgba(30,41,59,0.8)', borderLeft: '3px solid', borderColor: label === (isZh ? '核心风险' : 'Core Risk') ? 'error.main' : 'primary.main', borderRadius: 1 }}>
                                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>{label}</Typography>
                                <Typography variant="body2" sx={{ color: '#e2e8f0', mt: 0.25 }}>{val || '-'}</Typography>
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                      </>
                    )}

                    {selectedReport?.content?.assetOverview && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Box sx={{
                            width: 32, height: 32, borderRadius: 2,
                            background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
                          }}>
                            <BarChartIcon sx={{ color: '#fff', fontSize: 18 }} />
                          </Box>
                          <Typography variant="subtitle2" sx={{ color: '#38bdf8' }}>
                            {isZh ? '标的基础 & 行情概览' : 'Asset Overview & Market Context'}
                          </Typography>
                        </Box>
                        <Grid container spacing={1}>
                          {Object.entries(selectedReport.content.assetOverview).map(([key, val]: [string, any]) => {
                            const assetLabels: Record<string, string> = {
                              basicInfo: isZh ? '📋 基本信息' : '📋 Basic Info',
                              pricePerformance: isZh ? '💹 价格表现' : '💹 Price Performance',
                              marketCorrelation: isZh ? '🔗 大盘联动' : '🔗 Market Correlation',
                              trendQualification: isZh ? '📊 趋势定性' : '📊 Trend Qualification',
                            };
                            // Field-level label mapping for sub-objects
                            const assetFieldLabels: Record<string, Record<string, string>> = {
                              basicInfo: {
                                name: isZh ? '名称' : 'Name', code: isZh ? '代码' : 'Code',
                                market: isZh ? '市场' : 'Market', price: isZh ? '价格' : 'Price',
                                currency: isZh ? '币种' : 'Currency', exchange: isZh ? '交易所' : 'Exchange',
                              },
                              pricePerformance: {
                                dailyRange: isZh ? '日波动区间' : 'Daily Range',
                                weeklyChange: isZh ? '周涨幅' : 'Weekly Change',
                                volatility: isZh ? '波动性' : 'Volatility',
                                monthMTD: isZh ? '月至今' : 'Month MTD',
                                high52w: isZh ? '52周最高' : '52W High',
                                low52w: isZh ? '52周最低' : '52W Low',
                              },
                              marketCorrelation: {
                                sp500: isZh ? '标普500相关性' : 'S&P 500 Corr',
                                dxy: isZh ? '美元指数相关性' : 'DXY Corr',
                                notes: isZh ? '说明' : 'Notes',
                              },
                              trendQualification: {
                                trend: isZh ? '趋势方向' : 'Trend Direction',
                                strength: isZh ? '趋势强度' : 'Strength',
                                phase: isZh ? '周期阶段' : 'Phase',
                              },
                            };
                            const renderFieldValue = (k: string, v: any): React.ReactNode => {
                              const labels = assetFieldLabels[key];
                              if (labels && labels[k]) return `${labels[k]}：${v}`;
                              // Special mapping: investor-friendly name for forex/crypto assets
                              if (k === 'name' && typeof v === 'string') {
                                const nameMap: Record<string, string> = {
                                  '黄金/美元': isZh ? '现货黄金' : 'Gold (XAU/USD)',
                                  'XAUUSD': isZh ? '现货黄金' : 'Gold (XAUUSD)',
                                  'EUR/USD': isZh ? '欧元/美元' : 'Euro/US Dollar',
                                  'GBP/USD': isZh ? '英镑/美元' : 'British Pound/US Dollar',
                                  'USD/JPY': isZh ? '美元/日元' : 'US Dollar/Japanese Yen',
                                  'BTC/USD': isZh ? '比特币' : 'Bitcoin',
                                  'ETH/USD': isZh ? '以太坊' : 'Ethereum',
                                };
                                const label = labels?.[k] || k;
                                return `${label}：${nameMap[v] || v}`;
                              }
                              return `${k}: ${v}`;
                            };
                            return (
                            <Grid size={{ xs: 12, sm: key === 'basicInfo' ? 12 : 6 }} key={key}>
                              <Box sx={{ p: 1.2, bgcolor: 'rgba(15,23,42,0.7)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 1 }}>
                                <Typography variant="caption" sx={{ color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{assetLabels[key] || key}</Typography>
                                <Typography variant="body2" sx={{ color: '#cbd5e1', whiteSpace: 'pre-wrap', fontSize: '0.82rem' }}>
                                  {typeof val === 'object' && val !== null
                                    ? Object.entries(val).filter(([k]) => k !== 'price').map(([k, v]) => renderFieldValue(k, v)).join('\n')
                                    : String(val)}
                                </Typography>
                              </Box>
                            </Grid>
                            );
                          })}
                        </Grid>
                      </>
                    )}

                    {selectedReport?.content?.technicalAnalysis && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" gutterBottom sx={{ color: '#a78bfa' }}>
                          📈 {isZh ? '多周期技术面分析' : 'Multi-timeframe Technical Analysis'}
                        </Typography>
                        <Box sx={{ p: 1.5, bgcolor: 'rgba(88,28,135,0.15)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 1.5 }}>
                          {typeof selectedReport.content.technicalAnalysis === 'object' && !Array.isArray(selectedReport.content.technicalAnalysis) ? (
                            (() => {
                              // Field-level label maps for technical analysis sub-keys
                              const taFieldLabels: Record<string, Record<string, string>> = {
                                coreIndicators: {
                                  macd: 'MACD',
                                  rsi: 'RSI',
                                  boll: isZh ? '布林带' : 'Bollinger Bands',
                                  kdj: 'KDJ',
                                  ma: isZh ? '均线系统' : 'Moving Averages',
                                  volume: isZh ? '成交量' : 'Volume',
                                  atr: 'ATR',
                                },
                                keyLevels: {
                                  strongSupport: isZh ? '强支撑位' : 'Strong Support',
                                  weakSupport: isZh ? '弱支撑位' : 'Weak Support',
                                  strongResistance: isZh ? '强压力位' : 'Strong Resistance',
                                  weakResistance: isZh ? '弱压力位' : 'Weak Resistance',
                                  pivot: isZh ? '枢轴点' : 'Pivot Point',
                                  breakoutLevel: isZh ? '突破位' : 'Breakout Level',
                                },
                                timeframeConvergence: {},
                                patternAnalysis: {},
                              };
                              return Object.entries(selectedReport.content.technicalAnalysis).map(([key, val]: [string, any]) => (
                                <Box key={key} sx={{ mb: key !== 'patternAnalysis' ? 1.2 : 0 }}>
                                  <Typography variant="caption" sx={{ color: '#c4b5fd', fontWeight: 700 }}>{{
                                    timeframeConvergence: isZh ? '⏱ 多周期共振' : '⏱ Timeframe Convergence',
                                    coreIndicators: isZh ? '📐 核心指标' : '📐 Core Indicators',
                                    keyLevels: isZh ? '📍 关键价位' : '📍 Key Levels',
                                    patternAnalysis: isZh ? '🔍 形态分析' : '🔍 Pattern Analysis',
                                  }[key] || key}</Typography>
                                  <Typography variant="body2" sx={{ color: '#e2e8f0', fontSize: '0.82rem', whiteSpace: 'pre-wrap' }}>
                                    {typeof val === 'object' && val !== null
                                      ? Object.entries(val).map(([k, v]) => {
                                          const labels = taFieldLabels[key];
                                          return (labels && labels[k] ? labels[k] : k) + ': ' + String(v);
                                        }).join('\n')
                                      : String(val)}
                                  </Typography>
                                </Box>
                              ));
                            })()
                          ) : (
                            <Typography variant="body2" sx={{ color: '#e2e8f0' }}>{String(selectedReport.content.technicalAnalysis)}</Typography>
                          )}
                        </Box>
                      </>
                    )}

                    {selectedReport?.content?.fundSentiment && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" gutterBottom sx={{ color: '#fb923c' }}>
                          💰 {isZh ? '资金 & 市场情绪' : 'Fund Flow & Sentiment'}
                        </Typography>
                        <Box sx={{ p: 1.5, bgcolor: 'rgba(124,45,18,0.15)', border: '1px solid rgba(251,146,60,0.2)', borderRadius: 1.5 }}>
                          {Object.entries(selectedReport.content.fundSentiment).map(([key, val]: [string, any]) => (
                            <Box key={key} sx={{ mb: 0.8 }}>
                              <Typography variant="caption" sx={{ color: '#fdba74', fontWeight: 600 }}>{{
                                capitalFlow: isZh ? '💸 资金流向' : '💸 Capital Flow',
                                longShortRatio: isZh ? '⚖️ 多空比' : '⚖️ L/S Ratio',
                                positionData: isZh ? '📊 持仓数据' : '📊 Position Data',
                              }[key] || key}</Typography>
                              <Typography variant="body2" sx={{ color: '#fed7aa', fontSize: '0.82rem' }}>{String(val || '-')}</Typography>
                            </Box>
                          ))}
                        </Box>
                      </>
                    )}

                    {selectedReport?.content?.driversEvents && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" gutterBottom sx={{ color: '#4ade80' }}>
                          📅 {isZh ? '驱动因子 & 事件日历' : 'Drivers & Event Calendar'}
                        </Typography>
                        <Grid container spacing={1}>
                          {Object.entries(selectedReport.content.driversEvents).map(([key, val]: [string, any]) => (
                            <Grid size={{ xs: 12, md: key === 'currentFactors' ? 6 : 6 }} key={key}>
                              <Box sx={{ p: 1.2, bgcolor: 'rgba(20,83,45,0.2)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 1 }}>
                                <Typography variant="caption" sx={{ color: '#86efac', fontWeight: 700 }}>{{
                                  currentFactors: isZh ? '📌 当前驱动因子' : '📌 Current Drivers',
                                  upcomingEvents: isZh ? '📅 近期事件日历' : '📅 Upcoming Events',
                                }[key] || key}</Typography>
                                {(Array.isArray(val) ? val : []).map((item: any, idx: number) => (
                                  <Box key={idx} sx={{ display: 'flex', gap: 0.5, mt: 0.5, alignItems: 'flex-start' }}>
                                    <Chip size="small" color={item.type === 'positive' ? 'success' : 'error'} label={
                                      item.type === 'positive' ? (isZh ? '积极' : 'Positive') :
                                      item.type === 'negative' ? (isZh ? '消极' : 'Negative') : item.type
                                    } sx={{ height: 20, fontSize: '0.7rem' }} />
                                    <Typography variant="body2" sx={{ color: '#bbf7d0', fontSize: '0.8rem' }}>{item.factor || item.event || ''}{item.date ? ` (${item.date})` : ''}{item.impact ? ` — ${item.impact}` : ''}</Typography>
                                  </Box>
                                ))}
                                {!Array.isArray(val) && <Typography variant="body2" sx={{ color: '#bbf7d0', fontSize: '0.8rem' }}>{String(val)}</Typography>}
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                      </>
                    )}

                    {selectedReport?.content?.riskAssessment && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        {(() => {
                          const level = selectedReport.content.riskAssessment?.level || 'low';
                          const riskColorMap: Record<string, 'error' | 'warning' | 'success'> = { high: 'error', medium: 'warning', low: 'success' };
                          const riskLabelMap: Record<string, string> = {
                            high: isZh ? '\u{1F534} \u9AD8\u98CE\u9669' : '\u{1F534} High Risk',
                            medium: isZh ? '\u{1FAE0} \u4E2D\u98CE\u9669' : '\u{1FAE0} Medium Risk',
                            low: isZh ? '\u{1F7E2} \u4F4E\u98CE\u9669' : '\u{1F7E2} Low Risk',
                          };
                          return (
                            <>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Chip
                                  size="small"
                                  color={riskColorMap[level] || 'default'}
                                  label={riskLabelMap[level] || level}
                                />
                                <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                                  🗂️ {isZh ? '\u98CE\u9669\u5206\u7EA7\u8BC4\u4F30' : 'Risk Assessment'}
                                </Typography>
                              </Box>
                              <Alert severity={(selectedReport.content.riskAssessment.level as any) || 'info'} sx={{ mb: 0.5 }}>
                                <Typography variant="body2">{selectedReport.content.riskAssessment.explanation}</Typography>
                              </Alert>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {(selectedReport.content.riskAssessment.riskFactors || []).map((rf: string, i: number) => (
                                  <Chip key={i} size="small" variant="outlined" color="error" label={`\u26A0 ${rf}`} sx={{ fontSize: '0.78rem' }} />
                                ))}
                              </Box>
                            </>
                          );
                        })()}
                      </>
                    )}

                    {selectedReport?.content?.tradingSuggestions && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" gutterBottom sx={{ color: '#f472b6' }}>
                          💡 {isZh ? '分周期趋势参考' : 'Multi-period Trend Reference'}
                        </Typography>
                        <Box sx={{ p: 1.5, bgcolor: 'rgba(131,24,67,0.15)', border: '1px solid rgba(244,114,182,0.25)', borderRadius: 1.5 }}>
                          {(['intraday', 'swing', 'midterm'] as const).filter(k => selectedReport.content.tradingSuggestions[k]).map(period => {
                            const data = selectedReport.content.tradingSuggestions[period];
                            const periodLabels: Record<string, string> = {
                              intraday: isZh ? '⚡ 日内短线' : '⚡ Intraday',
                              swing: isZh ? '📊 波段' : '📊 Swing',
                              midterm: isZh ? '🎯 中线' : '🎯 Mid-term',
                            };
                            const fieldLabels: Record<string, { zh: string; en: string }> = {
                              trendBias:   { zh: '趋势偏向',     en: 'Trend Bias' },
                              keyObservation: { zh: '关键观察点',    en: 'Key Observation' },
                              volatilityNote:  { zh: '波动特征',      en: 'Volatility Note' },
                              trendLogic:  { zh: '趋势逻辑',       en: 'Trend Logic' },
                              supportResistanceContext: { zh: '支撑压力参考', en: 'S/R Context' },
                              momentumSignal:   { zh: '动量信号',       en: 'Momentum Signal' },
                              trendAssessment:  { zh: '趋势综合评估',   en: 'Trend Assessment' },
                              cyclePhase:   { zh: '周期阶段',        en: 'Cycle Phase' },
                              structuralNotes:  { zh: '结构性因素',     en: 'Structural Notes' },
                            };
                            return (
                              <Box key={period} sx={{ mb: 1.5, pb: 1.5, borderBottom: period !== 'midterm' ? '1px dashed rgba(244,114,182,0.2)' : 'none' }}>
                                <Typography variant="caption" sx={{ color: '#f9a8d4', fontWeight: 700, letterSpacing: 0.5, display: 'block', mb: 0.8 }}>
                                  {periodLabels[period] || period}
                                </Typography>
                                {typeof data === 'object' && data && Object.entries(data).map(([k, v]) => (
                                  <Box key={k} sx={{ mb: 0.5 }}>
                                    <Typography component="span" variant="body2" sx={{ color: '#fce7f3', fontSize: '0.78rem', fontWeight: 600 }}>
                                      {(fieldLabels[k] || { zh: k, en: k })[isZh ? 'zh' : 'en']}:
                                    </Typography>
                                    <Typography component="span" variant="body2" sx={{ color: '#fbcfe8', fontSize: '0.8rem', ml: 0.5 }}>{String(v ?? '-')}</Typography>
                                  </Box>
                                ))}
                              </Box>
                            );
                          })}
                        </Box>
                      </>
                    )}

                    {selectedReport?.content?.categorySpecific && typeof selectedReport.content.categorySpecific === 'object' && Object.keys(selectedReport.content.categorySpecific).length > 0 && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" gutterBottom sx={{ color: '#fbbf24' }}>
                          🏷️ {isZh ? '品类专属深度分析' : 'Category-Specific Deep Dive'}
                        </Typography>
                        <Paper elevation={0} sx={{ p: 1.5, bgcolor: 'rgba(120,53,15,0.12)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 1.5 }}>
                          {Object.entries(selectedReport.content.categorySpecific).map(([catKey, catVal]: [string, any]) => {
                            const catLabelMap: Record<string, string> = {
                              fundamentals: isZh ? '基本面分析' : 'Fundamentals',
                              institutionalRating: isZh ? '机构评级' : 'Institutional Rating',
                              industrySector: isZh ? '行业/板块' : 'Industry/Sector',
                              technologyBoardMomentum: isZh ? '科技板块动量' : 'Tech Board Momentum',
                              optionsData: isZh ? '期权数据' : 'Options Data',
                              macroDriver: isZh ? '宏观驱动因子' : 'Macro Driver',
                              specificRisks: isZh ? '特有风险提示' : 'Specific Risks',
                            };
                            const fieldLabelMap: Record<string, string> = {
                              fundamentals: isZh ? '基本面分析' : 'Fundamentals',
                              institutionalRating: isZh ? '机构评级' : 'Institutional Rating',
                              industrySector: isZh ? '行业板块' : 'Industry Sector',
                              technologyBoardMomentum: isZh ? '科技板动量' : 'Tech Board Momentum',
                              optionsData: isZh ? '期权数据' : 'Options Data',
                              macroDriver: isZh ? '宏观驱动' : 'Macro Driver',
                              specificRisks: isZh ? '特有风险' : 'Specific Risks',
                              earningsOutlook: isZh ? '盈利展望' : 'Earnings Outlook',
                              valuationMetrics: isZh ? '估值指标' : 'Valuation Metrics',
                              supplyDemand: isZh ? '供需格局' : 'Supply/Demand',
                              regulatoryFactors: isZh ? '监管因素' : 'Regulatory Factors',
                              geopoliticalRisk: isZh ? '地缘政治风险' : 'Geopolitical Risk',
                              // Forex category-specific fields
                              macroComparison: isZh ? '宏观对比' : 'Macro Comparison',
                              currencyAttributes: isZh ? '货币属性' : 'Currency Attributes',
                              sessionCharacteristics: isZh ? '盘面特征' : 'Session Characteristics',
                              capitalFlow: isZh ? '资金流向' : 'Capital Flow',
                            };
                            return (
                            <Box key={catKey} sx={{ mb: catKey !== Object.keys(selectedReport.content.categorySpecific!).slice(-1)[0] ? 1.5 : 0 }}>
                              <Chip size="small" color="primary" label={catLabelMap[catKey] || catKey} sx={{ mb: 0.8, textTransform: 'none', fontWeight: 700, letterSpacing: 0.5 }} />
                              {typeof catVal === 'object' && catVal !== null ? (
                                Object.entries(catVal).map(([field, value]: [string, any]) => (
                                  <Box key={field} sx={{ mb: 0.6, pl: 1 }}>
                                    <Typography variant="caption" sx={{ color: '#fcd34d', fontWeight: 600 }}>{fieldLabelMap[field] || field}</Typography>
                                    {Array.isArray(value) ? value.map((item: string, idx: number) => (
                                      <Typography key={idx} variant="body2" sx={{ color: '#fef3c7', fontSize: '0.8rem' }}>• {item}</Typography>
                                    )) : (
                                      <Typography variant="body2" sx={{ color: '#fef3c7', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{String(value)}</Typography>
                                    )}
                                  </Box>
                                ))
                              ) : (
                                <Typography variant="body2" sx={{ color: '#fef3c7' }}>{String(catVal)}</Typography>
                              )}
                            </Box>
                            );
                          })}
                        </Paper>
                      </>
                    )}

                    {/* ========== End V2 Modules ========== */}

                    </div>
                  </CardContent>
                </Card>

                {/* AI Follow-up Section */}
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">
                        <PsychologyIcon sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                        {isZh ? 'AI 追问' : 'AI Follow-up'}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {quotaData && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`${isZh ? '本月已用' : 'Used'}: ${quotaData.used}/${quotaData.limit}`}
                            color={quotaData.used >= quotaData.limit ? 'error' : 'default'}
                          />
                        )}
                        <Button
                          size="small"
                          startIcon={<HistoryIcon />}
                          onClick={() => setShowHistory(prev => !prev)}
                          color={showHistory ? 'primary' : 'inherit'}
                          variant={showHistory ? 'contained' : 'outlined'}
                          sx={{ textTransform: 'none' }}
                        >
                          {isZh ? '历史记录' : 'History'}
                        </Button>
                      </Box>
                    </Box>

                    {/* History List Panel */}
                    {showHistory && (
                      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, maxHeight: 400, overflowY: 'auto', borderRadius: 2, bgcolor: 'background.default' }}>
                        {questionsLoading ? (
                          <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={24} /></Box>
                        ) : !questionsData?.questions?.length ? (
                          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>
                            {isZh ? '暂无追问历史记录' : 'No follow-up history yet'}
                          </Typography>
                        ) : (
                          questionsData.questions.map((q) => {
                            const isExpanded = expandedQId === q.questionId;
                            return (
                              <Box key={q.questionId} sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}>
                                {/* Question row — clickable to expand */}
                                <Box
                                  onClick={() => setExpandedQId(isExpanded ? null : q.questionId)}
                                  sx={{
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 0.75,
                                    p: 1,
                                    borderRadius: 1.5,
                                    bgcolor: isExpanded ? 'primary.50' : 'transparent',
                                    border: `1px solid ${isExpanded ? 'primary.light' : 'divider'}`,
                                    transition: 'all 0.15s',
                                    '&:hover': { bgcolor: isExpanded ? 'primary.50' : 'action.hover' },
                                  }}
                                >
                                  {isExpanded ? <ExpandLessIcon sx={{ mt: 0.15, color: 'primary.main', fontSize: 18 }} /> : <ExpandMoreIcon sx={{ mt: 0.15, fontSize: 18 }} />}
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                      Q: {q.question}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.25, display: 'block' }}>
                                      {new Date(q.askedAt).toLocaleString()}
                                      {q.aiModel && ` · ${q.aiModel}`}
                                    </Typography>
                                  </Box>
                                </Box>

                                {/* Expanded answer */}
                                {isExpanded && (
                                  <Fade in timeout={250}>
                                    <Paper elevation={0} sx={{ ml: 2.5, mr: 0.5, mt: 0.75, p: 1.5, borderRadius: '4px 18px 18px 18px', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                                      <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600, display: 'block', mb: 0.5 }}>
                                        A:
                                      </Typography>
                                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6, color: 'text.primary' }}>
                                        {q.answer}
                                      </Typography>
                                    </Paper>
                                  </Fade>
                                )}
                              </Box>
                            );
                          })
                        )}
                      </Paper>
                    )}

                    {/* Smart Prompt Suggestions */}
                    {smartPrompts.length > 0 && !chatMessages.length && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                          <QuestionAnswerIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                          {isZh ? '基于您交易特征的智能追问建议：' : 'Smart prompts based on your trading profile:'}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                          {smartPrompts.map((prompt, idx) => (
                            <Chip
                              key={idx}
                              label={prompt}
                              variant="outlined"
                              size="small"
                              clickable
                              onClick={() => handleAskQuestion(prompt)}
                              icon={<QuestionAnswerIcon style={{ fontSize: 14 }} />}
                              sx={{
                                borderColor: 'primary.light',
                                '& .MuiChip-label': { fontSize: '0.78rem' },
                                maxWidth: '100%',
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}

                    {/* Chat Messages Area */}
                    {chatMessages.length > 0 && (
                      <Paper
                        variant="outlined"
                        sx={{ p: 2, maxHeight: 360, overflowY: 'auto', bgcolor: 'background.default', borderRadius: 2 }}
                      >
                        {chatMessages.map((msg, idx) => (
                          <Fade key={idx} in timeout={300}>
                            <Box sx={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', mb: 1.5 }}>
                              <Paper
                                elevation={0}
                                sx={{
                                  p: 1.5, px: 2, maxWidth: '85%',
                                  bgcolor: msg.role === 'user' ? 'primary.main' : 'background.paper',
                                  color: msg.role === 'user' ? 'white' : 'text.primary',
                                  borderRadius: msg.role === 'user' ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                                  wordBreak: 'break-word', whiteSpace: 'pre-wrap', typography: 'body2',
                                }}
                              >
                                {msg.role === 'assistant' && selectedReport?.aiModel && (
                                  <Typography variant="caption" component="div" sx={{ color: 'primary.main', fontWeight: 600, mb: 0.5, fontSize: '0.68rem', opacity: 0.8 }}>
                                    <Chip size="small" label={selectedReport.aiModel} variant="outlined" sx={{ height: 16, fontSize: '0.62rem', '& .MuiChip-label': { px: 0.5 } }} />
                                  </Typography>
                                )}
                                {msg.content}
                              </Paper>
                            </Box>
                          </Fade>
                        ))}
                        {asking && (
                          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1.5 }}>
                            <Paper elevation={0} sx={{ p: 1.5, px: 2, borderRadius: '4px 18px 18px 18px' }}>
                              <CircularProgress size={16} />
                            </Paper>
                          </Box>
                        )}
                        <div ref={chatEndRef} />
                      </Paper>
                    )}

                    {/* Question Input */}
                    <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'flex-start' }}>
                      <TextField
                        fullWidth
                        size="small"
                        multiline
                        maxRows={3}
                        placeholder={isFreeUser
                          ? (isZh ? 'AI 追问需要 Pro 或 Premium 版本' : 'AI follow-up requires Pro or Premium')
                          : (isZh ? '输入您的交易问题，例如：我最大的弱点是什么？' : 'Ask about your trading, e.g.: What are my biggest weaknesses?')}
                        value={questionInput}
                        onChange={(e) => setQuestionInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={asking || !selectedReportId || isFreeUser}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 }, flex: 1 }}
                      />
                      <IconButton
                        color="primary"
                        onClick={() => handleAskQuestion(questionInput)}
                        disabled={!questionInput.trim() || asking || !selectedReportId || isFreeUser}
                        sx={{ mt: 0.5, bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' }, '&:disabled': { bgcolor: 'action.disabledBackground' } }}
                      >
                        {asking ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                      </IconButton>
                    </Box>

                    {!selectedReportId && (
                      <Alert severity="info" sx={{ mt: 1 }}>
                        {isZh ? '请先选择一份报告后进行 AI 追问。' : 'Please select a report first to ask follow-up questions.'}
                      </Alert>
                    )}
                    {selectedReportId && isFreeUser && (
                      <Alert severity="warning" sx={{ mt: 1 }} action={
                        <Button size="small" color="warning" onClick={() => navigate('/settings?tab=subscription')}>
                          {isZh ? '升级' : 'Upgrade'}
                        </Button>
                      }>
                        {isZh
                          ? '免费用户无法使用 AI 追问功能。升级到 Pro 或 Premium 即可解锁追问功能，每月可使用 50 次 AI 追问。'
                          : 'Free users cannot use AI follow-up. Upgrade to Pro or Premium to unlock follow-up questions with 50 uses per month.'}
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Box>
            ) : (
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                  <AutoGraphIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                  <Typography sx={{ color: 'text.secondary' }}>{t('aiReports.selectReport')}</Typography>
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      </Box>

      <Snackbar
        open={!!creditToast}
        autoHideDuration={2000}
        onClose={() => setCreditToast('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{
          '& .MuiPaper-root': { bgcolor: 'transparent !important', boxShadow: 'none !important', backgroundColor: 'transparent !important' },
          '& .MuiSnackbarContent-root': { backgroundColor: 'transparent !important', color: '#E5A23C !important', fontWeight: 700, borderRadius: 8, fontSize: 15, justifyContent: 'center', padding: '8px 16px' }
        }}
        message={creditToast}
      />

      {/* Credit Confirmation Dialog */}
      <Dialog
        open={!!creditConfirmAction}
        onClose={() => setCreditConfirmAction(null)}
        maxWidth="xs"
        fullWidth
        disableEnforceFocus
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'warning.main' }}>
            {isZh ? '积分确认' : 'Credits Confirmation'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {isZh
              ? `您的本月${creditConfirmAction?.type === 'report' ? 'AI 报告' : 'AI 追问'}额度已用完，本次操作将消耗 ${creditConfirmAction?.cost || 0} 积分`
              : `Your monthly ${creditConfirmAction?.type === 'report' ? 'AI Report' : 'AI Follow-up'} quota is exhausted. This operation will cost ${creditConfirmAction?.cost || 0} credits`}
          </Alert>
          <Box sx={{ bgcolor: 'rgba(102,126,234,0.08)', borderRadius: 2, p: 2, mb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{isZh ? '当前可用积分' : 'Available Credits'}</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, color: 'primary.main' }}>{availableCredits.toLocaleString()}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{isZh ? '本次消耗' : 'Cost'}</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, color: 'error.main' }}>-{(creditConfirmAction?.cost || 0).toLocaleString()}</Typography>
            </Box>
          </Box>
          {availableCredits < (creditConfirmAction?.cost || 0) && (
            <Alert severity="error">
              {isZh
                ? '积分不足，请前往积分中心充值或升级套餐'
                : 'Insufficient credits. Please top up or upgrade your plan'}
              <Button size="small" color="error" sx={{ ml: 1 }} onClick={() => { navigate('/credits'); setCreditConfirmAction(null); }}>
                {isZh ? '去充值' : 'Top Up'}
              </Button>
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined" onClick={() => setCreditConfirmAction(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            disabled={availableCredits < (creditConfirmAction?.cost || 0)}
            onClick={() => creditConfirmAction?.onConfirm()}
            color="warning"
          >
            {isZh
              ? `确认消耗 ${creditConfirmAction?.cost || 0} 积分`
              : `Confirm -${creditConfirmAction?.cost || 0} Credits`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/** Format signed currency (+$123 or -$456) */
function fmtSignedCurrency(value: number): string {
  const prefix = value >= 0 ? '+$' : '-$';
  return `${prefix}${Math.abs(value).toFixed(2)}`;
}
