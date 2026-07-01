import { prisma } from './src/lib/prisma.ts';
import { localizePlaybook } from './src/services/translation.service.ts';

const ids = process.argv.slice(2);
if (!ids.length) {
  console.error('Usage: tsx inspect-playbook-translations.ts <id> ...');
  process.exit(1);
}

function englishLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 8 && !/[\u4e00-\u9fff]/.test(l) && /[a-zA-Z]{4,}/.test(l));
}

const prismaClient = prisma;

async function main() {
  for (const id of ids) {
    console.log('\n=== Retranslating', id, '===');

    await prismaClient.contentTranslation.deleteMany({
      where: { entityType: 'playbook', entityId: id, targetLocale: 'zh' },
    });

    const pb = await prismaClient.playbook.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        content: true,
        paidContent: true,
        tradingSymbols: true,
      },
    });

    if (!pb) {
      console.log('NOT FOUND');
      continue;
    }

    const localized = await localizePlaybook(pb, 'zh-CN', {
      includeContent: true,
      includePaidContent: true,
    });

    const lines = englishLines(localized.content || '');
    console.log('isTranslated:', localized.isTranslated);
    console.log('remaining english lines:', lines.length);
    for (const l of lines) {
      console.log(' ', l.slice(0, 140));
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prismaClient.$disconnect();
  });
