import { PrismaClient } from '@prisma/client';

declare global {
  // Allow global `var` declarations for hot-reloading in dev
  // eslint-disable-next-line no-var
  var prismaClientGlobal: PrismaClient | undefined;
}

export const db: PrismaClient =
  globalThis.prismaClientGlobal ??
  new PrismaClient({
    log: process.env.DEBUG_MODE === 'true' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaClientGlobal = db;
}
