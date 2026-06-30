import { createHash } from 'crypto';
import { prisma } from '../lib/prisma';
import logger from '../lib/logger';
import { aiProviderService, isModelAvailable, type AIModel } from './ai-provider.service';
import { ContentLocale, normalizeContentLocale, toApiLocale } from '../utils/locale.util';

const TRANSLATION_MODEL = (process.env.TRANSLATION_MODEL || 'gpt-5-mini') as AIModel;

const TRADING_TERMINOLOGY_PROMPT = `You are a professional translator for TradeAnchor, a trading journal and community platform.
Your audience are retail and professional traders. Follow these rules strictly:

GENERAL
- Translate naturally for traders in the target language; never sound like machine translation.
- Preserve ALL Markdown syntax, link URLs, image paths, code blocks, inline code, and list structure exactly.
- Do NOT translate: URLs, file paths, @handles, #hashtags used as tags, UUIDs, numbers, percentages, prices.

SYMBOLS & INSTRUMENTS (keep as-is unless a widely accepted local name exists)
- Forex pairs: EURUSD, GBPJPY, USDJPY, XAUUSD, XAGUSD, etc. — keep uppercase ticker format.
- Crypto: BTC, ETH, BTCUSDT, SOLUSDT — keep ticker; "USDT/USDC" unchanged.
- US stocks: AAPL, TSLA, NVDA — keep ticker symbols.
- Futures: ES, NQ, CL, GC — keep contract codes.
- Indices: SPX, NASDAQ, DAX — keep or use standard local name (e.g. 标普500 for S&P 500 in Chinese).

ORDER & POSITION TERMS
- SL → 止损 (zh) / stop loss (en); TP → 止盈 / take profit
- long/short → 做多/多单 / 做空/空单 (zh); keep long/short when natural in en
- entry/exit → 入场/进场 / 出场/平仓
- lot, pip, point, tick → 手, 点(pip), 点值 — use standard Chinese trading community terms
- stop hunt, liquidity grab → 扫止损 / 流动性猎取
- drawdown → 回撤; ROI → ROI or 收益率; PnL / P&L → 盈亏
- margin, leverage → 保证金, 杠杆
- spread, slippage → 点差, 滑点

TECHNICAL INDICATORS (use trader-familiar names)
- RSI → RSI (keep acronym); MACD → MACD; EMA/SMA → EMA/SMA or 均线 when describing concept
- Bollinger Bands → 布林带; ATR → ATR or 平均真实波幅
- Fibonacci → 斐波那契; support/resistance → 支撑/阻力
- breakout, pullback, retest → 突破, 回调, 回测
- overbought/oversold → 超买/超卖
- divergence → 背离; golden cross/death cross → 金叉/死叉

STRATEGY & MARKET TERMS
- scalping → 剥头皮/超短线; swing trading → 波段交易
- day trading → 日内交易; trend following → 趋势跟踪
- mean reversion → 均值回归; breakout strategy → 突破策略
- backtest → 回测; live trading → 实盘; demo account → 模拟盘
- EA / Expert Advisor → EA/智能交易系统 (zh)
- MT4/MT5 → MT4/MT5 (unchanged)

When translating TO English: use standard international trading English (not overly formal).
When translating TO Chinese: use terms Chinese traders use on forums like 雪球, 集思录, and FX communities.
Output ONLY valid JSON as requested — no markdown fences, no commentary.`;

export type TranslationField = 'title' | 'description' | 'content' | 'paidContent';

export interface LocalizedMeta {
  isTranslated: boolean;
  sourceLocale: string;
  originalTitle?: string;
  originalDescription?: string | null;
  originalContent?: string;
  originalPaidContent?: string | null;
}

function hashContent(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function isTranslationEnabled(): boolean {
  return isModelAvailable(TRANSLATION_MODEL);
}

/** Detect zh vs en from text using CJK ratio heuristic */
export function detectContentLanguage(text: string): ContentLocale {
  const sample = text.trim().slice(0, 2000);
  if (!sample) return 'en';

  const cjk = (sample.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
  const latin = (sample.match(/[a-zA-Z]/g) || []).length;

  if (cjk >= 4 && cjk >= latin * 0.25) return 'zh';
  return 'en';
}

async function getCachedTranslation(
  entityType: string,
  entityId: string,
  field: string,
  targetLocale: ContentLocale,
  sourceHash: string,
): Promise<string | null> {
  const row = await prisma.contentTranslation.findFirst({
    where: {
      entityType,
      entityId,
      field,
      targetLocale,
      sourceHash,
    },
    select: { translated: true },
  });
  return row?.translated ?? null;
}

async function saveTranslation(data: {
  entityType: string;
  entityId: string;
  field: string;
  sourceLocale: ContentLocale;
  targetLocale: ContentLocale;
  sourceHash: string;
  translated: string;
}): Promise<void> {
  await prisma.contentTranslation.upsert({
    where: {
      entityType_entityId_field_targetLocale_sourceHash: {
        entityType: data.entityType,
        entityId: data.entityId,
        field: data.field,
        targetLocale: data.targetLocale,
        sourceHash: data.sourceHash,
      },
    },
    create: data,
    update: { translated: data.translated },
  });
}

function localeLabel(locale: ContentLocale): string {
  return locale === 'zh' ? 'Simplified Chinese' : 'English';
}

function parseJsonFromLlm(raw: string): Record<string, string> {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : trimmed;
  const parsed = JSON.parse(jsonStr) as Record<string, string>;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid translation JSON');
  }
  return parsed;
}

async function callTranslationLlm(
  sourceLocale: ContentLocale,
  targetLocale: ContentLocale,
  payload: Record<string, string>,
  tradingSymbols?: string[],
): Promise<Record<string, string>> {
  const symbolHint = tradingSymbols?.length
    ? `\nRelated trading symbols for this post (DO NOT translate these tickers): ${tradingSymbols.join(', ')}`
    : '';

  const fieldsDesc = Object.entries(payload)
    .map(([key, val]) => `--- ${key} ---\n${val}`)
    .join('\n\n');

  const response = await aiProviderService.generateCompletion(
    TRANSLATION_MODEL,
    [
      { role: 'system', content: TRADING_TERMINOLOGY_PROMPT },
      {
        role: 'user',
        content: `Translate the following fields from ${localeLabel(sourceLocale)} to ${localeLabel(targetLocale)}.${symbolHint}

Return a JSON object with the same keys: ${JSON.stringify(Object.keys(payload))}

${fieldsDesc}`,
      },
    ],
    { maxTokens: 8192 },
  );

  return parseJsonFromLlm(response.content);
}

async function translateFields(
  entityType: 'playbook' | 'comment',
  entityId: string,
  fields: Record<TranslationField, string | null | undefined>,
  sourceLocale: ContentLocale,
  targetLocale: ContentLocale,
  tradingSymbols?: string[],
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const toTranslate: Record<string, string> = {};

  for (const [field, value] of Object.entries(fields)) {
    if (value == null || !String(value).trim()) continue;
    const text = String(value);
    const sourceHash = hashContent(text);
    const cached = await getCachedTranslation(entityType, entityId, field, targetLocale, sourceHash);
    if (cached != null) {
      result[field] = cached;
    } else {
      toTranslate[field] = text;
    }
  }

  if (Object.keys(toTranslate).length === 0) return result;

  if (!isTranslationEnabled()) {
    logger.warn('Translation skipped: OFOX not configured');
    for (const [field, text] of Object.entries(toTranslate)) {
      result[field] = text;
    }
    return result;
  }

  try {
    const translated = await callTranslationLlm(sourceLocale, targetLocale, toTranslate, tradingSymbols);
    for (const [field, original] of Object.entries(toTranslate)) {
      const text = translated[field]?.trim() || original;
      result[field] = text;
      await saveTranslation({
        entityType,
        entityId,
        field,
        sourceLocale,
        targetLocale,
        sourceHash: hashContent(original),
        translated: text,
      });
    }
  } catch (err) {
    logger.error('LLM translation failed, falling back to original', {
      entityType,
      entityId,
      error: err instanceof Error ? err.message : err,
    });
    for (const [field, text] of Object.entries(toTranslate)) {
      result[field] = text;
    }
  }

  return result;
}

function sampleTextForDetection(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' ').trim();
}

export async function localizePlaybook<T extends {
  id: string;
  title: string;
  description?: string | null;
  content?: string;
  paidContent?: string | null;
  tradingSymbols?: string[];
}>(
  playbook: T,
  targetLocaleInput: string,
  options?: { includeContent?: boolean; includePaidContent?: boolean },
): Promise<T & LocalizedMeta> {
  const targetLocale = normalizeContentLocale(targetLocaleInput);
  const includeContent = options?.includeContent ?? true;
  const includePaidContent = options?.includePaidContent ?? false;

  const sourceLocale = detectContentLanguage(
    sampleTextForDetection([playbook.title, playbook.description, includeContent ? playbook.content : null]),
  );

  if (sourceLocale === targetLocale) {
    return {
      ...playbook,
      isTranslated: false,
      sourceLocale: toApiLocale(sourceLocale),
    };
  }

  const fields: Record<TranslationField, string | null | undefined> = {
    title: playbook.title,
    description: playbook.description,
    content: includeContent ? playbook.content : undefined,
    paidContent: includePaidContent ? playbook.paidContent : undefined,
  };

  const translated = await translateFields(
    'playbook',
    playbook.id,
    fields,
    sourceLocale,
    targetLocale,
    playbook.tradingSymbols,
  );

  const meta: LocalizedMeta = {
    isTranslated: true,
    sourceLocale: toApiLocale(sourceLocale),
    originalTitle: playbook.title,
    originalDescription: playbook.description,
  };

  if (includeContent && playbook.content != null) {
    meta.originalContent = playbook.content;
  }
  if (includePaidContent && playbook.paidContent != null) {
    meta.originalPaidContent = playbook.paidContent;
  }

  return {
    ...playbook,
    title: translated.title ?? playbook.title,
    description: translated.description !== undefined ? (translated.description || null) : playbook.description,
    ...(includeContent && translated.content !== undefined ? { content: translated.content } : {}),
    ...(includePaidContent && translated.paidContent !== undefined
      ? { paidContent: translated.paidContent || null }
      : {}),
    ...meta,
  };
}

export async function localizePlaybooks<T extends {
  id: string;
  title: string;
  description?: string | null;
  content?: string;
  tradingSymbols?: string[];
}>(
  playbooks: T[],
  targetLocaleInput: string,
): Promise<Array<T & Pick<LocalizedMeta, 'isTranslated' | 'sourceLocale'>>> {
  return Promise.all(
    playbooks.map((pb) =>
      localizePlaybook(pb, targetLocaleInput, { includeContent: false, includePaidContent: false }),
    ),
  );
}

export async function localizeComment<T extends { id: string; content: string }>(
  comment: T,
  targetLocaleInput: string,
): Promise<T & Pick<LocalizedMeta, 'isTranslated' | 'sourceLocale'> & { originalContent?: string }> {
  const targetLocale = normalizeContentLocale(targetLocaleInput);
  const sourceLocale = detectContentLanguage(comment.content);

  if (sourceLocale === targetLocale) {
    return {
      ...comment,
      isTranslated: false,
      sourceLocale: toApiLocale(sourceLocale),
    };
  }

  const translated = await translateFields(
    'comment',
    comment.id,
    { title: undefined, description: undefined, content: comment.content, paidContent: undefined },
    sourceLocale,
    targetLocale,
  );

  return {
    ...comment,
    content: translated.content ?? comment.content,
    isTranslated: true,
    sourceLocale: toApiLocale(sourceLocale),
    originalContent: comment.content,
  };
}

export async function localizeComments<T extends { id: string; content: string }>(
  comments: T[],
  targetLocaleInput: string,
): Promise<Array<T & Pick<LocalizedMeta, 'isTranslated' | 'sourceLocale'> & { originalContent?: string }>> {
  return Promise.all(comments.map((c) => localizeComment(c, targetLocaleInput)));
}

/** Fire-and-forget: pre-warm translation cache for the opposite locale */
export function warmPlaybookTranslationCache(playbook: {
  id: string;
  title: string;
  description?: string | null;
  content: string;
  paidContent?: string | null;
  tradingSymbols?: string[];
}): void {
  setImmediate(async () => {
    try {
      const sourceLocale = detectContentLanguage(
        sampleTextForDetection([playbook.title, playbook.description, playbook.content]),
      );
      const targetLocale: ContentLocale = sourceLocale === 'zh' ? 'en' : 'zh';

      await translateFields(
        'playbook',
        playbook.id,
        {
          title: playbook.title,
          description: playbook.description,
          content: playbook.content,
          paidContent: playbook.paidContent,
        },
        sourceLocale,
        targetLocale,
        playbook.tradingSymbols,
      );
      logger.info('Playbook translation cache warmed', { playbookId: playbook.id, targetLocale });
    } catch (err) {
      logger.warn('Failed to warm playbook translation cache', {
        playbookId: playbook.id,
        error: err instanceof Error ? err.message : err,
      });
    }
  });
}

export function warmCommentTranslationCache(comment: { id: string; content: string }): void {
  setImmediate(async () => {
    try {
      const sourceLocale = detectContentLanguage(comment.content);
      const targetLocale: ContentLocale = sourceLocale === 'zh' ? 'en' : 'zh';

      await translateFields(
        'comment',
        comment.id,
        { title: undefined, description: undefined, content: comment.content, paidContent: undefined },
        sourceLocale,
        targetLocale,
      );
    } catch (err) {
      logger.warn('Failed to warm comment translation cache', {
        commentId: comment.id,
        error: err instanceof Error ? err.message : err,
      });
    }
  });
}
