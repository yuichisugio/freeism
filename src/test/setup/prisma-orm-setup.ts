import type { DeepMockProxy } from "vitest-mock-extended";
import { type PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

// Prismaモックのエクスポート（テストファイルで使用するため）
export const prismaMock: DeepMockProxy<PrismaClient> = mockDeep<PrismaClient>();

// jest-mock-extendedを使用したPrisma クライアントのモック
vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  __esModule: true,
}));

// 各テスト前にPrismaモックをリセット
beforeEach(() => {
  mockReset(prismaMock);
});
