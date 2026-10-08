import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial teacher user and clean brain state...');

  // 1. Teacher User
  await prisma.user.upsert({
    where: { email: 'teacher@guardedmarkets.local' },
    update: {},
    create: {
      email: 'teacher@guardedmarkets.local',
      name: 'Lead Trader & Teacher',
      role: 'TEACHER',
    },
  });

  // 2. Initialize Brain Version 1.0 (empty baseline, waits for teacher lessons)
  const existingVersion = await prisma.brainVersion.findFirst({
    where: { versionTag: 'v1.0' },
  });

  if (!existingVersion) {
    await prisma.brainVersion.create({
      data: {
        version: 1.0,
        versionTag: 'v1.0',
        changeSummary: 'Initial empty baseline. Ready for teacher video lesson ingestion.',
      },
    });
  }

  console.log('Clean database baseline initialized. Zero preloaded/fake trading rules.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
