import { createHash } from 'crypto';
import { prisma } from '../lib/prisma';
import logger from '../lib/logger';
import { aiProviderService, isModelAvailable, MODEL_REGISTRY, type AIModel } from './ai-provider.service';
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

COMPLETENESS (critical)
- Translate EVERY heading, subheading, bullet point, numbered item, and paragraph.
- Never leave English sentences or section titles untranslated when the target is Chinese (and vice versa).
- Keep the same document structure and section count as the source.

Output ONLY valid JSON as requested — no markdown fences, no commentary.`;

/** Long markdown fields are translated in chunks to avoid LLM output truncation. */
const LONG_FIELD_CHUNK_CHARS = 1800;

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

function countCjkChars(text: string): number {
  return (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
}

/** Lines that look like English headings or bullet prose (not tickers/code). */
function countUntranslatedEnglishProseLines(text: string): number {
  return text.split('\n').filter((line) => lineNeedsLocalePatch(line, 'zh')).length;
}

function lineNeedsLocalePatch(line: string, targetLocale: ContentLocale): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 6) return false;
  if (/^```/.test(trimmed)) return false;
  if (/^!\[.*\]\([^)]+\)\s*$/.test(trimmed)) return false;
  if (/^https?:\/\//.test(trimmed)) return false;

  if (targetLocale === 'zh') {
    if (/[\u4e00-\u9fff]/.test(trimmed)) return false;
    return /[a-zA-Z]{3,}/.test(trimmed);
  }

  if (!/[\u4e00-\u9fff]/.test(trimmed)) return false;
  return true;
}

function isLongTranslationField(field: string): boolean {
  return field === 'content' || field === 'paidContent';
}

/** Split long markdown/text into chunks safe for a single LLM response. */
export function splitTextForTranslation(text: string, maxChars = LONG_FIELD_CHUNK_CHARS): string[] {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length <= maxChars) return [text];

  const chunks: string[] = [];
  const flush = (buf: string) => {
    if (buf.trim()) chunks.push(buf);
  };

  const pushOversizedBlock = (block: string) => {
    const paragraphs = block.split(/\n\n+/);
    let paraBuf = '';
    for (const para of paragraphs) {
      const candidate = paraBuf ? `${paraBuf}\n\n${para}` : para;
      if (candidate.length <= maxChars) {
        paraBuf = candidate;
        continue;
      }
      flush(paraBuf);
      if (para.length <= maxChars) {
        paraBuf = para;
        continue;
      }
      for (let i = 0; i < para.length; i += maxChars) {
        chunks.push(para.slice(i, i + maxChars));
      }
      paraBuf = '';
    }
    flush(paraBuf);
  };

  const sections = trimmed.split(/(?=\n#{1,4}\s)/);
  let buffer = '';
  for (const section of sections) {
    if (section.length > maxChars) {
      flush(buffer);
      buffer = '';
      pushOversizedBlock(section);
    } else if ((buffer + section).length <= maxChars) {
      buffer += section;
    } else {
      flush(buffer);
      buffer = section;
    }
  }
  flush(buffer);

  return chunks.length > 0 ? chunks : [text];
}

/** Detect cached/partial translations that still contain too much source language. */
export function isTranslationLikelyComplete(
  source: string,
  translated: string,
  sourceLocale: ContentLocale,
  targetLocale: ContentLocale,
): boolean {
  if (sourceLocale === targetLocale) return true;

  const sourceLen = source.trim().length;
  const translatedLen = translated.trim().length;
  if (sourceLen < 120) return true;

  const sourceCjk = countCjkChars(source);
  const translatedCjk = countCjkChars(translated);
  const sourceEnglishLines = countUntranslatedEnglishProseLines(source);

  if (translatedLen < sourceLen * 0.45 && sourceLen > 800) return false;

  if (targetLocale === 'zh' && sourceLocale === 'en') {
    if (sourceCjk < sourceLen * 0.05 && translatedCjk < Math.min(sourceLen * 0.12, 80)) {
      return false;
    }
    const remainingPatchLines = countUntranslatedEnglishProseLines(translated);
    if (sourceEnglishLines >= 3 && remainingPatchLines >= 3) {
      return false;
    }
    if (sourceEnglishLines >= 8 && remainingPatchLines >= Math.ceil(sourceEnglishLines * 0.15)) {
      return false;
    }
  }

  if (targetLocale === 'en' && sourceLocale === 'zh') {
    if (sourceCjk > sourceLen * 0.2 && translatedCjk > translatedLen * 0.25) {
      return false;
    }
  }

  return true;
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

async function deleteCachedTranslation(
  entityType: string,
  entityId: string,
  field: string,
  targetLocale: ContentLocale,
  sourceHash: string,
): Promise<void> {
  await prisma.contentTranslation.deleteMany({
    where: { entityType, entityId, field, targetLocale, sourceHash },
  });
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
  try {
    const parsed = JSON.parse(jsonStr) as Record<string, string>;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid translation JSON');
    }
    return parsed;
  } catch (err) {
    // Recover from truncated JSON: {"line_0":"...","line_1":"..."}
    const partial: Record<string, string> = {};
    const pairRe = /"(line_\d+)"\s*:\s*"((?:\\.|[^"\\])*)"/g;
    let match: RegExpExecArray | null;
    while ((match = pairRe.exec(jsonStr)) !== null) {
      partial[match[1]] = match[2]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }
    if (Object.keys(partial).length > 0) return partial;
    throw err;
  }
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

  const modelMaxTokens = MODEL_REGISTRY[TRANSLATION_MODEL]?.maxTokens ?? 4096;
  const response = await aiProviderService.generateCompletion(
    TRANSLATION_MODEL,
    [
      { role: 'system', content: TRADING_TERMINOLOGY_PROMPT },
      {
        role: 'user',
        content: `Translate the following fields from ${localeLabel(sourceLocale)} to ${localeLabel(targetLocale)}.${symbolHint}

Return a JSON object with the same keys: ${JSON.stringify(Object.keys(payload))}
Each value must be a single-line JSON string (use \\n for line breaks inside a value if needed).

${fieldsDesc}`,
      },
    ],
    { maxTokens: modelMaxTokens },
  );

  return parseJsonFromLlm(response.content);
}

async function patchRemainingUntranslatedLines(
  text: string,
  sourceLocale: ContentLocale,
  targetLocale: ContentLocale,
  tradingSymbols?: string[],
): Promise<string> {
  if (sourceLocale === targetLocale) return text;

  const lines = text.split('\n');
  const indices = lines
    .map((line, index) => (lineNeedsLocalePatch(line, targetLocale) ? index : -1))
    .filter((index) => index >= 0);

  if (indices.length === 0) return text;

  const updated = [...lines];
  const batchSize = 6;

  for (let i = 0; i < indices.length; i += batchSize) {
    const batchIndices = indices.slice(i, i + batchSize);
    const payload: Record<string, string> = {};
    batchIndices.forEach((idx, j) => {
      payload[`line_${j}`] = lines[idx].trim();
    });

    try {
      const translated = await callTranslationLlm(sourceLocale, targetLocale, payload, tradingSymbols);
      batchIndices.forEach((idx, j) => {
        const patched = translated[`line_${j}`]?.trim();
        if (!patched) return;
        if (targetLocale === 'zh' && !/[\u4e00-\u9fff]/.test(patched)) return;
        const indent = lines[idx].match(/^(\s*)/)?.[1] || '';
        updated[idx] = indent + patched;
      });
    } catch (err) {
      logger.warn('Patch translation batch failed, trying line-by-line', {
        batchSize: batchIndices.length,
        error: err instanceof Error ? err.message : err,
      });
      for (const idx of batchIndices) {
        try {
          const single = await callTranslationLlm(
            sourceLocale,
            targetLocale,
            { line: lines[idx].trim() },
            tradingSymbols,
          );
          const patched = single.line?.trim();
          if (!patched) continue;
          if (targetLocale === 'zh' && !/[\u4e00-\u9fff]/.test(patched)) continue;
          const indent = lines[idx].match(/^(\s*)/)?.[1] || '';
          updated[idx] = indent + patched;
        } catch (lineErr) {
          logger.warn('Patch translation line failed', {
            line: lines[idx].trim().slice(0, 80),
            error: lineErr instanceof Error ? lineErr.message : lineErr,
          });
        }
      }
    }
  }

  return updated.join('\n');
}

async function translateTextField(
  field: TranslationField,
  text: string,
  sourceLocale: ContentLocale,
  targetLocale: ContentLocale,
  tradingSymbols?: string[],
): Promise<string> {
  const chunks = splitTextForTranslation(text);
  let result: string;
  if (chunks.length === 1) {
    const single = await callTranslationLlm(sourceLocale, targetLocale, { [field]: text }, tradingSymbols);
    result = single[field]?.trim() || text;
  } else {
    const translatedParts: string[] = [];
    for (const chunk of chunks) {
      const part = await callTranslationLlm(sourceLocale, targetLocale, { [field]: chunk }, tradingSymbols);
      translatedParts.push(part[field]?.trim() || chunk);
    }
    result = translatedParts.join('');
  }

  return patchRemainingUntranslatedLines(result, sourceLocale, targetLocale, tradingSymbols);
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
      if (isTranslationLikelyComplete(text, cached, sourceLocale, targetLocale)) {
        result[field] = cached;
        continue;
      }
      await deleteCachedTranslation(entityType, entityId, field, targetLocale, sourceHash);
    }
    toTranslate[field] = text;
  }

  if (Object.keys(toTranslate).length === 0) return result;

  if (!isTranslationEnabled()) {
    logger.warn('Translation skipped: OFOX not configured');
    for (const [field, text] of Object.entries(toTranslate)) {
      result[field] = text;
    }
    return result;
  }

  for (const [field, original] of Object.entries(toTranslate)) {
    try {
      const text = isLongTranslationField(field)
        ? await translateTextField(field as TranslationField, original, sourceLocale, targetLocale, tradingSymbols)
        : (await callTranslationLlm(sourceLocale, targetLocale, { [field]: original }, tradingSymbols))[field]?.trim() || original;

      if (!isTranslationLikelyComplete(original, text, sourceLocale, targetLocale)) {
        logger.warn('Translation quality check failed, using original text', { entityType, entityId, field });
        result[field] = original;
        continue;
      }

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
    } catch (err) {
      logger.error('LLM translation failed for field, falling back to original', {
        entityType,
        entityId,
        field,
        error: err instanceof Error ? err.message : err,
      });
      result[field] = original;
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
