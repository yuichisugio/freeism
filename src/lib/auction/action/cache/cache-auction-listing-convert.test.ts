import { faker } from "@faker-js/faker";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

// テスト対象の型と関数をインポート
import type { ExecutorJsonItem, ExecutorJsonItemFromDB } from "./cache-auction-listing";
import { isExecutorObjectFromDB } from "./cache-auction-listing";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * データ整形ロジック（テスト対象）
 * 元のコードから抽出したロジック
 */
function convertExecutorsJson(executorsJsonString: string | null): ExecutorJsonItem[] {
  let taskExecutors: ExecutorJsonItem[] = [];

  if (executorsJsonString && typeof executorsJsonString === "string") {
    try {
      const parsedExecutorsUnknown: unknown = JSON.parse(executorsJsonString);

      if (Array.isArray(parsedExecutorsUnknown)) {
        const parsedExecutors = parsedExecutorsUnknown as unknown[];

        taskExecutors = parsedExecutors
          .map((exec: unknown): ExecutorJsonItem | null => {
            if (isExecutorObjectFromDB(exec)) {
              return {
                id: exec.id,
                rating: exec.rating,
                userId: exec.user_id,
                userImage: exec.user_image,
                userSettingsUsername: exec.username ?? "未設定",
              };
            }
            return null;
          })
          .filter((exec): exec is ExecutorJsonItem => exec !== null);
      }
    } catch (e) {
      console.error("Failed to parse taskExecutors_json", e, executorsJsonString);
      taskExecutors = [];
    }
  }

  return taskExecutors;
}

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
 */

// 有効なExecutorJsonItemFromDBオブジェクトを作成
const createValidExecutorFromDB = (overrides: Partial<ExecutorJsonItemFromDB> = {}): ExecutorJsonItemFromDB => {
  return executorJsonItemFromDBFactory.build(overrides);
};

// 有効なJSON文字列を作成
const createValidExecutorsJsonString = (executors: ExecutorJsonItemFromDB[]): string => {
  return JSON.stringify(executors);
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
        expect(result).toBe(true);
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
        expect(result).toBe(true);
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
        expect(result).toBe(true);
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
        expect(result).toBe(true);
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
        expect(result).toBe(true);
      });
    });

    describe("異常系", () => {
      test("nullに対してfalseを返す", () => {
        // Act
        const result = isExecutorObjectFromDB(null);

        // Assert
        expect(result).toBe(false);
      });

      test("undefinedに対してfalseを返す", () => {
        // Act
        const result = isExecutorObjectFromDB(undefined);

        // Assert
        expect(result).toBe(false);
      });

      test("オブジェクト以外の型に対してfalseを返す", () => {
        // Arrange & Act & Assert
        expect(isExecutorObjectFromDB("string")).toBe(false);
        expect(isExecutorObjectFromDB(123)).toBe(false);
        expect(isExecutorObjectFromDB(true)).toBe(false);
        expect(isExecutorObjectFromDB([])).toBe(false);
        expect(
          isExecutorObjectFromDB(() => {
            // 空の関数
          }),
        ).toBe(false);
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
        expect(isExecutorObjectFromDB(incompleteObject1)).toBe(false);
        expect(isExecutorObjectFromDB(incompleteObject2)).toBe(false);
        expect(isExecutorObjectFromDB(incompleteObject3)).toBe(false);
        expect(isExecutorObjectFromDB(incompleteObject4)).toBe(false);
        expect(isExecutorObjectFromDB(incompleteObject5)).toBe(false);
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
        expect(isExecutorObjectFromDB(invalidObject1)).toBe(false);
        expect(isExecutorObjectFromDB(invalidObject2)).toBe(false);
        expect(isExecutorObjectFromDB(invalidObject3)).toBe(false);
        expect(isExecutorObjectFromDB(invalidObject4)).toBe(false);
        expect(isExecutorObjectFromDB(invalidObject5)).toBe(false);
      });

      test("空のオブジェクトに対してfalseを返す", () => {
        // Act
        const result = isExecutorObjectFromDB({});

        // Assert
        expect(result).toBe(false);
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
        expect(result).toBe(false);
      });
    });
  });

  describe("convertExecutorsJson データ整形ロジック", () => {
    describe("正常系", () => {
      test("有効なJSON文字列を正しくExecutorJsonItem配列に変換する", () => {
        // Arrange
        const executor1 = createValidExecutorFromDB({
          id: "exec1",
          user_id: "user1",
          username: "User One",
          rating: 4.5,
        });
        const executor2 = createValidExecutorFromDB({
          id: "exec2",
          user_id: "user2",
          username: "User Two",
          rating: 3.8,
        });
        const executorsJsonString = createValidExecutorsJsonString([executor1, executor2]);

        // Act
        const result = convertExecutorsJson(executorsJsonString);

        // Assert
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          id: "exec1",
          rating: 4.5,
          userId: "user1",
          userImage: executor1.user_image,
          userSettingsUsername: "User One",
        });
        expect(result[1]).toEqual({
          id: "exec2",
          rating: 3.8,
          userId: "user2",
          userImage: executor2.user_image,
          userSettingsUsername: "User Two",
        });
      });

      test("usernameがnullの場合に「未設定」をデフォルト値として設定する", () => {
        // Arrange
        const executor = createValidExecutorFromDB({
          id: "exec1",
          user_id: "user1",
          username: null,
          rating: 4.0,
        });
        const executorsJsonString = createValidExecutorsJsonString([executor]);

        // Act
        const result = convertExecutorsJson(executorsJsonString);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0].userSettingsUsername).toBe("未設定");
      });

      test("null値を含むExecutorJsonItemFromDBを正しく変換する", () => {
        // Arrange
        const executor = createValidExecutorFromDB({
          id: null,
          user_id: null,
          user_image: null,
          username: null,
          rating: null,
        });
        const executorsJsonString = createValidExecutorsJsonString([executor]);

        // Act
        const result = convertExecutorsJson(executorsJsonString);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          id: null,
          rating: null,
          userId: null,
          userImage: null,
          userSettingsUsername: "未設定",
        });
      });

      test("空の配列のJSON文字列を正しく処理する", () => {
        // Arrange
        const executorsJsonString = JSON.stringify([]);

        // Act
        const result = convertExecutorsJson(executorsJsonString);

        // Assert
        expect(result).toEqual([]);
      });

      test("nullの場合に空の配列を返す", () => {
        // Act
        const result = convertExecutorsJson(null);

        // Assert
        expect(result).toEqual([]);
      });

      test("空文字列の場合に空の配列を返す", () => {
        // Act
        const result = convertExecutorsJson("");

        // Assert
        expect(result).toEqual([]);
      });
    });

    describe("異常系", () => {
      test("無効なJSON文字列の場合にエラーログを出力し空の配列を返す", () => {
        // Arrange
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
          // コンソールエラーを抑制
        });
        const invalidJsonString = "{ invalid json }";

        // Act
        const result = convertExecutorsJson(invalidJsonString);

        // Assert
        expect(result).toEqual([]);
        expect(consoleSpy).toHaveBeenCalledWith(
          "Failed to parse taskExecutors_json",
          expect.any(Error),
          invalidJsonString,
        );

        // Cleanup
        consoleSpy.mockRestore();
      });

      test("JSON文字列が配列でない場合に空の配列を返す", () => {
        // Arrange
        const nonArrayJsonString = JSON.stringify({ not: "array" });

        // Act
        const result = convertExecutorsJson(nonArrayJsonString);

        // Assert
        expect(result).toEqual([]);
      });

      test("配列内に無効なオブジェクトが含まれている場合にそれらを除外する", () => {
        // Arrange
        const validExecutor = createValidExecutorFromDB({
          id: "valid-exec",
          user_id: "valid-user",
          username: "Valid User",
        });
        const invalidExecutor = {
          id: "invalid-exec",
          // user_idが欠けている
          user_image: "invalid-image",
          username: "Invalid User",
          rating: 3.0,
        };
        const mixedArray = [validExecutor, invalidExecutor, "not-an-object", null];
        const mixedJsonString = JSON.stringify(mixedArray);

        // Act
        const result = convertExecutorsJson(mixedJsonString);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          id: "valid-exec",
          rating: validExecutor.rating,
          userId: "valid-user",
          userImage: validExecutor.user_image,
          userSettingsUsername: "Valid User",
        });
      });

      test("全て無効なオブジェクトの配列の場合に空の配列を返す", () => {
        // Arrange
        const invalidArray = [{ invalid: "object1" }, { another: "invalid", object: 2 }, "string", 123, null];
        const invalidJsonString = JSON.stringify(invalidArray);

        // Act
        const result = convertExecutorsJson(invalidJsonString);

        // Assert
        expect(result).toEqual([]);
      });

      test("文字列型でない引数の場合に空の配列を返す", () => {
        // Act & Assert
        expect(convertExecutorsJson(123 as unknown as string | null)).toEqual([]);
        expect(convertExecutorsJson(true as unknown as string | null)).toEqual([]);
        expect(convertExecutorsJson({} as unknown as string | null)).toEqual([]);
        expect(convertExecutorsJson([] as unknown as string | null)).toEqual([]);
      });
    });

    describe("エッジケース", () => {
      test("大きな配列を正しく処理する", () => {
        // Arrange
        const executors = Array.from({ length: 100 }, (_, i) =>
          createValidExecutorFromDB({
            id: `exec-${i}`,
            user_id: `user-${i}`,
            username: `User ${i}`,
            rating: Math.random() * 5,
          }),
        );
        const executorsJsonString = createValidExecutorsJsonString(executors);

        // Act
        const result = convertExecutorsJson(executorsJsonString);

        // Assert
        expect(result).toHaveLength(100);
        expect(result[0].id).toBe("exec-0");
        expect(result[99].id).toBe("exec-99");
      });

      test("特殊文字を含むusernameを正しく処理する", () => {
        // Arrange
        const executor = createValidExecutorFromDB({
          id: "exec1",
          user_id: "user1",
          username: "User@#$%^&*()_+{}|:<>?[]\\;',./`~",
          rating: 4.0,
        });
        const executorsJsonString = createValidExecutorsJsonString([executor]);

        // Act
        const result = convertExecutorsJson(executorsJsonString);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0].userSettingsUsername).toBe("User@#$%^&*()_+{}|:<>?[]\\;',./`~");
      });

      test("非常に長いusernameを正しく処理する", () => {
        // Arrange
        const longUsername = "a".repeat(1000);
        const executor = createValidExecutorFromDB({
          id: "exec1",
          user_id: "user1",
          username: longUsername,
          rating: 4.0,
        });
        const executorsJsonString = createValidExecutorsJsonString([executor]);

        // Act
        const result = convertExecutorsJson(executorsJsonString);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0].userSettingsUsername).toBe(longUsername);
      });

      test("極端なrating値を正しく処理する", () => {
        // Arrange
        const executor1 = createValidExecutorFromDB({
          id: "exec1",
          user_id: "user1",
          username: "User One",
          rating: 0,
        });
        const executor2 = createValidExecutorFromDB({
          id: "exec2",
          user_id: "user2",
          username: "User Two",
          rating: Number.MAX_SAFE_INTEGER,
        });
        const executor3 = createValidExecutorFromDB({
          id: "exec3",
          user_id: "user3",
          username: "User Three",
          rating: -Number.MAX_SAFE_INTEGER,
        });
        const executorsJsonString = createValidExecutorsJsonString([executor1, executor2, executor3]);

        // Act
        const result = convertExecutorsJson(executorsJsonString);

        // Assert
        expect(result).toHaveLength(3);
        expect(result[0].rating).toBe(0);
        expect(result[1].rating).toBe(Number.MAX_SAFE_INTEGER);
        expect(result[2].rating).toBe(-Number.MAX_SAFE_INTEGER);
      });
    });
  });
});
