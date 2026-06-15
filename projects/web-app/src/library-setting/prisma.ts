import { PrismaClient } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * PrismaClientのインスタンス
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * PrismaClientのインスタンス
 */
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ["info", "warn", "error"] });

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * PrismaClientのインスタンスをグローバルに保存する
 */
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * PrismaClientのインスタンスをエクスポートする
 */
export { prisma };
