import type { DeepMockProxy } from "vitest-mock-extended";
import { type PrismaClient } from "@prisma/client";
import { beforeEach, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";

// Prismaモックのエクスポート（テストファイルで使用するため）
export const prismaMock: DeepMockProxy<PrismaClient> = vi.mocked(mockDeep<PrismaClient>());

// jest-mock-extendedを使用したPrisma クライアントのモック
vi.mock("@/library-setting/prisma", () => ({
  prisma: prismaMock,
  __esModule: true,
}));

// 各テスト前にPrismaモックをリセット
beforeEach(() => {
  mockReset(prismaMock);
});
