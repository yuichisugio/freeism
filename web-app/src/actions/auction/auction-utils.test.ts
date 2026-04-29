// テスト対象の型と関数をインポート
import type { ExecutorJsonItemFromDB } from "@/actions/auction/auction-utils";
import { isExecutorObjectFromDB } from "@/actions/auction/auction-utils";
import { faker } from "@faker-js/faker";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fisheryファクトリーを使用したテストデータ作成
 */

// ExecutorJsonItemFromDBファクトリー
const executorJsonItemFromDBFactory = Factory.define<ExecutorJsonItemFromDB>(({ sequence, params }) => ({
  id: params.id ?? `executor-${sequence}`,
  user_id: params.user_id ?? `user-${sequence}`,
  user_image: params.user_image ?? faker.image.avatar(),
  username: params.username ?? faker.person.fullName(),
  rating: params.rating ?? faker.number.float({ min: 1, max: 5 }),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ作成ヘルパー関数
 * 有効なExecutorJsonItemFromDBオブジェクトを作成
 */

const createValidExecutorFromDB = (overrides: Partial<ExecutorJsonItemFromDB> = {}): ExecutorJsonItemFromDB => {
  return executorJsonItemFromDBFactory.build(overrides);
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("cache-auction-listing データ整形ロジック", () => {
  // 各テスト前にモックをリセット
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isExecutorObjectFromDB", () => {
    describe("正常系", () => {
      test("有効なExecutorJsonItemFromDBオブジェクトに対してtrueを返す", () => {
        // Arrange
        const validExecutor = createValidExecutorFromDB();

        // Act
        const result = isExecutorObjectFromDB(validExecutor);

        // Assert
        expect(result.success).toBe(true);
        expect(result.data).not.toBeNull();
        expect(result.message).toBe("オブジェクトがExecutorJsonItemFromDB型かどうかを判定しました");
      });

      test("null値を含むExecutorJsonItemFromDBに対してtrueを返す", () => {
        // Arrange
        const executorWithNulls = createValidExecutorFromDB({
          id: null,
          user_id: null,
          user_image: null,
          username: null,
          rating: null,
        });

        // Act
        const result = isExecutorObjectFromDB(executorWithNulls);

        // Assert
        expect(result.success).toBe(true);
        expect(result.data).not.toBeNull();
        expect(result.message).toBe("オブジェクトがExecutorJsonItemFromDB型かどうかを判定しました");
      });

      test("各フィールドが正しい型の場合にtrueを返す", () => {
        // Arrange
        const executor = {
          id: "test-id",
          user_id: "test-user-id",
          user_image: "https://example.com/image.jpg",
          username: "testuser",
          rating: 4.5,
        };

        // Act
        const result = isExecutorObjectFromDB(executor);

        // Assert
        expect(result.success).toBe(true);
        expect(result.data).not.toBeNull();
        expect(result.message).toBe("オブジェクトがExecutorJsonItemFromDB型かどうかを判定しました");
      });

      test("文字列フィールドがnullの場合にtrueを返す", () => {
        // Arrange
        const executor = {
          id: null,
          user_id: null,
          user_image: null,
          username: null,
          rating: 3.0,
        };

        // Act
        const result = isExecutorObjectFromDB(executor);

        // Assert
        expect(result.success).toBe(true);
        expect(result.data).not.toBeNull();
        expect(result.message).toBe("オブジェクトがExecutorJsonItemFromDB型かどうかを判定しました");
      });

      test("ratingがnullの場合にtrueを返す", () => {
        // Arrange
        const executor = {
          id: "test-id",
          user_id: "test-user-id",
          user_image: "test-image",
          username: "testuser",
          rating: null,
        };

        // Act
        const result = isExecutorObjectFromDB(executor);

        // Assert
        expect(result.success).toBe(true);
        expect(result.data).not.toBeNull();
        expect(result.message).toBe("オブジェクトがExecutorJsonItemFromDB型かどうかを判定しました");
      });
    });

    describe("異常系", () => {
      test("nullに対してfalseを返す", () => {
        // Act
        const result = isExecutorObjectFromDB(null);

        // Assert
        expect(result.success).toBe(false);
        expect(result.data).toBeNull();
        expect(result.message).toBe("オブジェクトではありません");
      });

      test("undefinedに対してfalseを返す", () => {
        // Act
        const result = isExecutorObjectFromDB(undefined);

        // Assert
        expect(result.success).toBe(false);
        expect(result.data).toBeNull();
        expect(result.message).toBe("オブジェクトではありません");
      });

      test("オブジェクト以外の型に対してfalseを返す", () => {
        // Arrange & Act & Assert
        const stringResult = isExecutorObjectFromDB("string");
        expect(stringResult.success).toBe(false);
        expect(stringResult.data).toBeNull();
        expect(stringResult.message).toBe("オブジェクトではありません");

        const numberResult = isExecutorObjectFromDB(123);
        expect(numberResult.success).toBe(false);
        expect(numberResult.data).toBeNull();
        expect(numberResult.message).toBe("オブジェクトではありません");

        const booleanResult = isExecutorObjectFromDB(true);
        expect(booleanResult.success).toBe(false);
        expect(booleanResult.data).toBeNull();
        expect(booleanResult.message).toBe("オブジェクトではありません");

        const arrayResult = isExecutorObjectFromDB([]);
        expect(arrayResult.success).toBe(false);
        expect(arrayResult.data).toBeNull();
        expect(arrayResult.message).toBe("オブジェクトがExecutorJsonItemFromDB型かどうかを判定しました");

        const functionResult = isExecutorObjectFromDB(() => {
          // 空の関数
        });
        expect(functionResult.success).toBe(false);
        expect(functionResult.data).toBeNull();
        expect(functionResult.message).toBe("オブジェクトではありません");
      });

      test("必須フィールドが欠けているオブジェクトに対してfalseを返す", () => {
        // Arrange - idフィールドが欠けている
        const incompleteObject1 = {
          user_id: "test-user-id",
          user_image: "test-image",
          username: "test-username",
          rating: 4.5,
        };

        // Arrange - user_idフィールドが欠けている
        const incompleteObject2 = {
          id: "test-id",
          user_image: "test-image",
          username: "test-username",
          rating: 4.5,
        };

        // Arrange - user_imageフィールドが欠けている
        const incompleteObject3 = {
          id: "test-id",
          user_id: "test-user-id",
          username: "test-username",
          rating: 4.5,
        };

        // Arrange - usernameフィールドが欠けている
        const incompleteObject4 = {
          id: "test-id",
          user_id: "test-user-id",
          user_image: "test-image",
          rating: 4.5,
        };

        // Arrange - ratingフィールドが欠けている
        const incompleteObject5 = {
          id: "test-id",
          user_id: "test-user-id",
          user_image: "test-image",
          username: "test-username",
        };

        // Act & Assert
        expect(isExecutorObjectFromDB(incompleteObject1).success).toBe(false);
        expect(isExecutorObjectFromDB(incompleteObject2).success).toBe(false);
        expect(isExecutorObjectFromDB(incompleteObject3).success).toBe(false);
        expect(isExecutorObjectFromDB(incompleteObject4).success).toBe(false);
        expect(isExecutorObjectFromDB(incompleteObject5).success).toBe(false);
      });

      test("フィールドの型が無効な場合にfalseを返す", () => {
        // Arrange - idが文字列でもnullでもない
        const invalidObject1 = {
          id: 123,
          user_id: "test-user-id",
          user_image: "test-image",
          username: "test-username",
          rating: 4.5,
        };

        // Arrange - user_idが文字列でもnullでもない
        const invalidObject2 = {
          id: "test-id",
          user_id: 456,
          user_image: "test-image",
          username: "test-username",
          rating: 4.5,
        };

        // Arrange - user_imageが文字列でもnullでもない
        const invalidObject3 = {
          id: "test-id",
          user_id: "test-user-id",
          user_image: 789,
          username: "test-username",
          rating: 4.5,
        };

        // Arrange - usernameが文字列でもnullでもない
        const invalidObject4 = {
          id: "test-id",
          user_id: "test-user-id",
          user_image: "test-image",
          username: 101112,
          rating: 4.5,
        };

        // Arrange - ratingが数値でもnullでもない
        const invalidObject5 = {
          id: "test-id",
          user_id: "test-user-id",
          user_image: "test-image",
          username: "test-username",
          rating: "invalid-rating",
        };

        // Act & Assert
        expect(isExecutorObjectFromDB(invalidObject1).success).toBe(false);
        expect(isExecutorObjectFromDB(invalidObject2).success).toBe(false);
        expect(isExecutorObjectFromDB(invalidObject3).success).toBe(false);
        expect(isExecutorObjectFromDB(invalidObject4).success).toBe(false);
        expect(isExecutorObjectFromDB(invalidObject5).success).toBe(false);
      });

      test("空のオブジェクトに対してfalseを返す", () => {
        // Act
        const result = isExecutorObjectFromDB({});

        // Assert
        expect(result.success).toBe(false);
        expect(result.data).toBeNull();
        expect(result.message).toBe("オブジェクトがExecutorJsonItemFromDB型かどうかを判定しました");
      });

      test("余分なプロパティを持つが必須フィールドが欠けているオブジェクトに対してfalseを返す", () => {
        // Arrange
        const objectWithExtraProps = {
          id: "test-id",
          // user_idが欠けている
          user_image: "test-image",
          username: "test-username",
          rating: 4.5,
          extraField: "extra-value",
          anotherField: 123,
        };

        // Act
        const result = isExecutorObjectFromDB(objectWithExtraProps);

        // Assert
        expect(result.success).toBe(false);
        expect(result.data).toBeNull();
        expect(result.message).toBe("オブジェクトがExecutorJsonItemFromDB型かどうかを判定しました");
      });
    });
  });
});
