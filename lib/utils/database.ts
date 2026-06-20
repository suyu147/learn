import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export const db = {
  stageOutlines: {
    get: async (stageId: string) => {
      return prisma.stageOutline.findUnique({ where: { stageId } }) as Promise<{
        stageId: string;
        outlines: unknown[];
        createdAt: number;
        updatedAt: number;
      } | undefined>;
    },
    put: async (record: { stageId: string; outlines: unknown[]; createdAt: number; updatedAt: number }) => {
      return prisma.stageOutline.upsert({
        where: { stageId: record.stageId },
        update: { outlines: JSON.parse(JSON.stringify(record.outlines)), updatedAt: record.updatedAt },
        create: record as Parameters<typeof prisma.stageOutline.create>[0]['data'],
      });
    },
  },
} as const;

export default prisma;
