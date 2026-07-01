import { prisma } from './src/lib/prisma.ts';

const ids = [
  'f16fb895-a7d4-41a6-8821-89b679a4eb05',
  '45b4c62c-6f5d-4436-b06e-e3553b065d48',
  '3baf31e3-8134-453f-8f9b-ca5cdb28af4f',
];

function englishLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 8 && !/[\u4e00-\u9fff]/.test(l) && /[a-zA-Z]{4,}/.test(l));
}

const prismaClient = prisma;

async function main() {
  for (const id of ids) {
    const pb = await prismaClient.playbook.findUnique({
      where: { id },
      select: { id: true, title: true, content: true },
    });
    if (!pb) {
      console.log('===', id, 'NOT FOUND');
      continue;
    }

    console.log('===', id);
    console.log('orig english lines:', englishLines(pb.content || '').length);

    const cached = await prismaClient.contentTranslation.findMany({
      where: { entityType: 'playbook', entityId: id, field: 'content', targetLocale: 'zh' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (!cached[0]) {
      console.log('no zh cache');
      continue;
    }

    const lines = englishLines(cached[0].translated);
    console.log('cached english lines:', lines.length);
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
