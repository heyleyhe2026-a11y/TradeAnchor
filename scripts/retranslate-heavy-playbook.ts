/**
 * One-off operational script for long playbooks that fail JSON batch translation.
 * Splits content by numbered sections, translates each section as plain text, saves cache.
 * Usage (inside backend container):
 *   pnpm exec tsx retranslate-heavy-playbook.ts <playbookId> [zh|en]
 */
import { createHash } from 'crypto';
import { prisma } from './src/lib/prisma.ts';
import { aiProviderService, isModelAvailable, MODEL_REGISTRY } from './src/services/ai-provider.service.ts';
import { detectContentLanguage } from './src/services/translation.service.ts';
import type { ContentLocale } from './src/utils/locale.util.ts';

const MODEL = (process.env.TRANSLATION_MODEL || 'gpt-5-mini') as string;

const SYSTEM_PROMPT = `You are a professional translator for TradeAnchor trading community posts.
Translate the given section to the target language naturally for traders.
Keep tickers (XAUUSD, EURUSD), MT4/MT5, EA, RSI, ATR, SMA, parameter names, numbers, formulas, URLs, and image markdown unchanged.
Translate ALL headings, bullets, and sentences — do not leave English when target is Chinese.
Output ONLY the translated text — no JSON, no commentary.`;

function hash(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function splitSections(content: string): string[] {
  const parts = content.split(/(?=\n\d+\.\s)/).filter((p) => p.trim());
  if (parts.length > 1) return parts;
  return content.split(/(?=\n#{1,3}\s)/).filter((p) => p.trim());
}

async function translateSection(
  text: string,
  sourceLocale: ContentLocale,
  targetLocale: ContentLocale,
): Promise<string> {
  const target = targetLocale === 'zh' ? 'Simplified Chinese' : 'English';
  const source = sourceLocale === 'zh' ? 'Simplified Chinese' : 'English';
  const maxTokens = MODEL_REGISTRY[MODEL]?.maxTokens ?? 4096;

  const response = await aiProviderService.generateCompletion(
    MODEL,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Translate from ${source} to ${target}:\n\n${text.trim()}`,
      },
    ],
    { maxTokens },
  );

  return response.content.trim() || text;
}

async function saveCache(
  entityId: string,
  field: string,
  sourceLocale: ContentLocale,
  targetLocale: ContentLocale,
  original: string,
  translated: string,
) {
  const sourceHash = hash(original);
  await prisma.contentTranslation.upsert({
    where: {
      entityType_entityId_field_targetLocale_sourceHash: {
        entityType: 'playbook',
        entityId,
        field,
        targetLocale,
        sourceHash,
      },
    },
    create: {
      entityType: 'playbook',
      entityId,
      field,
      sourceLocale,
      targetLocale,
      sourceHash,
      translated,
    },
    update: { translated },
  });
}

async function main() {
  const id = process.argv[2];
  const targetLocale: ContentLocale = process.argv[3]?.startsWith('en') ? 'en' : 'zh';
  if (!id) {
    console.error('Usage: tsx retranslate-heavy-playbook.ts <playbookId> [zh|en]');
    process.exit(1);
  }

  if (!isModelAvailable(MODEL)) {
    console.error('Translation model not available:', MODEL);
    process.exit(1);
  }

  const pb = await prisma.playbook.findUnique({
    where: { id },
    select: { id: true, title: true, description: true, content: true },
  });

  if (!pb?.content) {
    console.error('Playbook not found or empty content');
    process.exit(1);
  }

  const sourceLocale = detectContentLanguage(`${pb.title} ${pb.description || ''} ${pb.content}`);
  if (sourceLocale === targetLocale) {
    console.log('Source and target locale are the same, nothing to do.');
    return;
  }

  console.log('Playbook:', id);
  console.log('Source locale:', sourceLocale, '-> Target:', targetLocale);

  await prisma.contentTranslation.deleteMany({
    where: { entityType: 'playbook', entityId: id, targetLocale },
  });

  for (const field of ['title', 'description'] as const) {
    const original = pb[field];
    if (!original?.trim()) continue;
    console.log(`Translating ${field}...`);
    const translated = await translateSection(original, sourceLocale, targetLocale);
    await saveCache(id, field, sourceLocale, targetLocale, original, translated);
    console.log(`  ${field} done`);
  }

  const sections = splitSections(pb.content);
  console.log(`Translating content in ${sections.length} section(s)...`);

  const translatedParts: string[] = [];
  for (let i = 0; i < sections.length; i++) {
    console.log(`  section ${i + 1}/${sections.length} (${sections[i].length} chars)...`);
    const part = await translateSection(sections[i], sourceLocale, targetLocale);
    translatedParts.push(part);
  }

  const translatedContent = translatedParts.join('');
  await saveCache(id, 'content', sourceLocale, targetLocale, pb.content, translatedContent);

  const englishLeft = translatedContent
    .split('\n')
    .filter((l) => l.trim().length >= 8 && !/[\u4e00-\u9fff]/.test(l) && /[a-zA-Z]{4,}/.test(l));

  console.log('Done. Remaining english-like lines:', englishLeft.length);
  for (const l of englishLeft.slice(0, 10)) {
    console.log(' ', l.slice(0, 120));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
