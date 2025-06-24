import type { Group } from "@/types/group-types";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { groupFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { getCachedGroupById } from "./cache-group-detail";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("getCachedGroupById", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    prismaMock.group.findUnique.mockReset();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系", () => {
    test("should return group data when valid groupId is provided", async () => {
      // テストデータの準備
      const mockGroupId = "test-group-id";
      const mockMembers = [{ userId: "user-1" }, { userId: "user-2" }, { userId: "user-3" }];

      const mockGroupData = {
        id: mockGroupId,
        name: "テストグループ",
        goal: "テスト目標",
        evaluationMethod: "自動評価",
        depositPeriod: 30,
        maxParticipants: 10,
        members: mockMembers,
      };

      // Prismaモックの設定
      prismaMock.group.findUnique.mockResolvedValue(
        mockGroupData as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );

      // 関数実行
      const result = await getCachedGroupById(mockGroupId);

      // 期待値の定義
      const expectedGroup: Group = {
        id: mockGroupId,
        name: "テストグループ",
        goal: "テスト目標",
        evaluationMethod: "自動評価",
        joinMemberCount: 3,
        maxParticipants: 10,
        depositPeriod: 30,
        members: mockMembers,
      };

      // 検証
      expect(result).toStrictEqual(expectedGroup);
      expect(prismaMock.group.findUnique).toHaveBeenCalledTimes(1);
      expect(prismaMock.group.findUnique).toHaveBeenCalledWith({
        where: { id: mockGroupId },
        select: {
          id: true,
          name: true,
          goal: true,
          evaluationMethod: true,
          depositPeriod: true,
          maxParticipants: true,
          members: {
            select: { userId: true },
          },
        },
      });
    });

    test("should return group data with empty members array when group has no members", async () => {
      // テストデータの準備（メンバーなし）
      const mockGroupId = "test-group-no-members";
      const mockGroupData = {
        id: mockGroupId,
        name: "メンバーなしグループ",
        goal: "メンバーなしテスト",
        evaluationMethod: "手動評価",
        depositPeriod: 7,
        maxParticipants: 5,
        members: [],
      };

      // Prismaモックの設定
      prismaMock.group.findUnique.mockResolvedValue(
        mockGroupData as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );

      // 関数実行
      const result = await getCachedGroupById(mockGroupId);

      // 期待値の定義
      const expectedGroup: Group = {
        id: mockGroupId,
        name: "メンバーなしグループ",
        goal: "メンバーなしテスト",
        evaluationMethod: "手動評価",
        joinMemberCount: 0,
        maxParticipants: 5,
        depositPeriod: 7,
        members: [],
      };

      // 検証
      expect(result).toStrictEqual(expectedGroup);
      expect(result.joinMemberCount).toBe(0);
      expect(result.members).toHaveLength(0);
    });

    test("should return group data with maximum members when group is full", async () => {
      // テストデータの準備（最大メンバー数）
      const mockGroupId = "test-group-full";
      const maxParticipants = 2;
      const mockMembers = [{ userId: "user-1" }, { userId: "user-2" }];

      const mockGroupData = {
        id: mockGroupId,
        name: "満員グループ",
        goal: "満員テスト",
        evaluationMethod: "自動評価",
        depositPeriod: 14,
        maxParticipants,
        members: mockMembers,
      };

      // Prismaモックの設定
      prismaMock.group.findUnique.mockResolvedValue(
        mockGroupData as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );

      // 関数実行
      const result = await getCachedGroupById(mockGroupId);

      // 検証
      expect(result.joinMemberCount).toBe(maxParticipants);
      expect(result.maxParticipants).toBe(maxParticipants);
      expect(result.members).toHaveLength(maxParticipants);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系", () => {
    test("should throw error when group is not found", async () => {
      // テストデータの準備
      const nonExistentGroupId = "non-existent-group-id";

      // Prismaモックの設定（グループが見つからない場合）
      prismaMock.group.findUnique.mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );

      // 関数実行と検証
      await expect(getCachedGroupById(nonExistentGroupId)).rejects.toThrow("グループが見つかりません");

      // Prismaが正しく呼ばれたことを確認
      expect(prismaMock.group.findUnique).toHaveBeenCalledTimes(1);
      expect(prismaMock.group.findUnique).toHaveBeenCalledWith({
        where: { id: nonExistentGroupId },
        select: {
          id: true,
          name: true,
          goal: true,
          evaluationMethod: true,
          depositPeriod: true,
          maxParticipants: true,
          members: {
            select: { userId: true },
          },
        },
      });
    });

    test("should throw error when database error occurs", async () => {
      // テストデータの準備
      const mockGroupId = "test-group-db-error";
      const dbError = new Error("Database connection failed");

      // Prismaモックの設定（データベースエラー）
      prismaMock.group.findUnique.mockRejectedValue(
        dbError as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );

      // 関数実行と検証
      await expect(getCachedGroupById(mockGroupId)).rejects.toThrow("Database connection failed");

      // Prismaが正しく呼ばれたことを確認
      expect(prismaMock.group.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle empty string groupId", async () => {
      // テストデータの準備
      const emptyGroupId = "";

      // Prismaモックの設定
      prismaMock.group.findUnique.mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );

      // 関数実行と検証
      await expect(getCachedGroupById(emptyGroupId)).rejects.toThrow("グループが見つかりません");

      // Prismaが正しく呼ばれたことを確認
      expect(prismaMock.group.findUnique).toHaveBeenCalledWith({
        where: { id: emptyGroupId },
        select: {
          id: true,
          name: true,
          goal: true,
          evaluationMethod: true,
          depositPeriod: true,
          maxParticipants: true,
          members: {
            select: { userId: true },
          },
        },
      });
    });

    test("should handle very long groupId", async () => {
      // テストデータの準備（非常に長いID）
      const longGroupId = "a".repeat(1000);

      // Prismaモックの設定
      prismaMock.group.findUnique.mockResolvedValue(null);

      // 関数実行と検証
      await expect(getCachedGroupById(longGroupId)).rejects.toThrow("グループが見つかりません");

      // Prismaが正しく呼ばれたことを確認
      expect(prismaMock.group.findUnique).toHaveBeenCalledWith({
        where: { id: longGroupId },
        select: {
          id: true,
          name: true,
          goal: true,
          evaluationMethod: true,
          depositPeriod: true,
          maxParticipants: true,
          members: {
            select: { userId: true },
          },
        },
      });
    });

    test("should handle special characters in groupId", async () => {
      // テストデータの準備（特殊文字を含むID）
      const specialCharGroupId = "test-group-!@#$%^&*()_+-=[]{}|;:,.<>?";

      // Prismaモックの設定
      prismaMock.group.findUnique.mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );

      // 関数実行と検証
      await expect(getCachedGroupById(specialCharGroupId)).rejects.toThrow("グループが見つかりません");

      // Prismaが正しく呼ばれたことを確認
      expect(prismaMock.group.findUnique).toHaveBeenCalledWith({
        where: { id: specialCharGroupId },
        select: {
          id: true,
          name: true,
          goal: true,
          evaluationMethod: true,
          depositPeriod: true,
          maxParticipants: true,
          members: {
            select: { userId: true },
          },
        },
      });
    });

    test("should handle minimum depositPeriod value", async () => {
      // テストデータの準備（最小値）
      const mockGroupId = "test-group-min-deposit";
      const mockGroupData = {
        id: mockGroupId,
        name: "最小預金期間グループ",
        goal: "最小値テスト",
        evaluationMethod: "自動評価",
        depositPeriod: 1,
        maxParticipants: 1,
        members: [{ userId: "user-1" }],
      };

      // Prismaモックの設定
      prismaMock.group.findUnique.mockResolvedValue(
        mockGroupData as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );

      // 関数実行
      const result = await getCachedGroupById(mockGroupId);

      // 検証
      expect(result.depositPeriod).toBe(1);
      expect(result.maxParticipants).toBe(1);
      expect(result.joinMemberCount).toBe(1);
    });

    test("should handle large numbers for maxParticipants and depositPeriod", async () => {
      // テストデータの準備（大きな値）
      const mockGroupId = "test-group-large-values";
      const largeMaxParticipants = 999999;
      const largeDepositPeriod = 365;

      const mockGroupData = {
        id: mockGroupId,
        name: "大きな値グループ",
        goal: "大きな値テスト",
        evaluationMethod: "手動評価",
        depositPeriod: largeDepositPeriod,
        maxParticipants: largeMaxParticipants,
        members: [],
      };

      // Prismaモックの設定
      prismaMock.group.findUnique.mockResolvedValue(
        mockGroupData as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );

      // 関数実行
      const result = await getCachedGroupById(mockGroupId);

      // 検証
      expect(result.depositPeriod).toBe(largeDepositPeriod);
      expect(result.maxParticipants).toBe(largeMaxParticipants);
      expect(result.joinMemberCount).toBe(0);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("データ変換テスト", () => {
    test("should correctly map members array", async () => {
      // テストデータの準備（複数のメンバー）
      const mockGroupId = "test-group-members-mapping";
      const mockMembers = [
        { userId: "user-001" },
        { userId: "user-002" },
        { userId: "user-003" },
        { userId: "user-004" },
        { userId: "user-005" },
      ];

      const mockGroupData = {
        id: mockGroupId,
        name: "メンバーマッピングテストグループ",
        goal: "メンバーマッピングテスト",
        evaluationMethod: "自動評価",
        depositPeriod: 21,
        maxParticipants: 10,
        members: mockMembers,
      };

      // Prismaモックの設定
      prismaMock.group.findUnique.mockResolvedValue(
        mockGroupData as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );

      // 関数実行
      const result = await getCachedGroupById(mockGroupId);

      // 検証
      expect(result.members).toHaveLength(5);
      expect(result.joinMemberCount).toBe(5);
      expect(result.members).toStrictEqual(mockMembers);

      // 各メンバーの構造を確認
      result.members.forEach((member, index) => {
        expect(member).toHaveProperty("userId");
        expect(member.userId).toBe(`user-00${index + 1}`);
      });
    });

    test("should correctly calculate joinMemberCount from members array length", async () => {
      // テストデータの準備（メンバー数の計算確認）
      const mockGroupId = "test-group-member-count";
      const mockMembers = Array.from({ length: 7 }, (_, i) => ({ userId: `user-${i + 1}` }));

      const mockGroupData = {
        id: mockGroupId,
        name: "メンバー数計算テストグループ",
        goal: "メンバー数計算テスト",
        evaluationMethod: "手動評価",
        depositPeriod: 15,
        maxParticipants: 10,
        members: mockMembers,
      };

      // Prismaモックの設定
      prismaMock.group.findUnique.mockResolvedValue(
        mockGroupData as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>,
      );

      // 関数実行
      const result = await getCachedGroupById(mockGroupId);

      // 検証
      expect(result.joinMemberCount).toBe(7);
      expect(result.members).toHaveLength(7);
      expect(result.joinMemberCount).toBe(result.members.length);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("型安全性テスト", () => {
    test("should return Group type with all required properties", async () => {
      // テストデータの準備
      const mockGroupId = "test-group-type-safety";
      const mockGroupData = groupFactory.build({
        id: mockGroupId,
      });

      // Prismaモックの設定
      prismaMock.group.findUnique.mockResolvedValue({
        id: mockGroupData.id,
        name: mockGroupData.name,
        goal: mockGroupData.goal,
        evaluationMethod: mockGroupData.evaluationMethod,
        depositPeriod: mockGroupData.depositPeriod,
        maxParticipants: mockGroupData.maxParticipants,
        members: [{ userId: "user-1" }, { userId: "user-2" }],
      } as unknown as Awaited<ReturnType<typeof prismaMock.group.findUnique>>);

      // 関数実行
      const result = await getCachedGroupById(mockGroupId);

      // 型安全性の検証
      expect(typeof result.id).toBe("string");
      expect(typeof result.name).toBe("string");
      expect(typeof result.goal).toBe("string");
      expect(typeof result.evaluationMethod).toBe("string");
      expect(typeof result.joinMemberCount).toBe("number");
      expect(typeof result.maxParticipants).toBe("number");
      expect(typeof result.depositPeriod).toBe("number");
      expect(Array.isArray(result.members)).toBe(true);

      // メンバー配列の型確認
      result.members.forEach((member) => {
        expect(typeof member.userId).toBe("string");
        expect(Object.keys(member)).toStrictEqual(["userId"]);
      });
    });
  });
});
