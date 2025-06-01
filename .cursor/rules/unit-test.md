# 単体テストの書き方

## **単体テスト全般**

- TDDを実施する。コード生成する際は、対応するユニットテストを常に生成する。
- コードを追加/修正した際は、`pnpm test`でテストがパスするか常に確認する
- コードカバレッジ

  - C0は85%以上、C1は80%以上、C2は80%以上を目指す

- 重複テスト・重複コードの実装を避け、できる限り統合して一つにまとめる
- 使用禁止：`as any`

- `pnpm run test:coverage`を実行して、現在のカバレッジを取得して、最もカバレッジが上がるコードを考察してからコード実装して、再度カバレッジを取得して数値が向上していることを確認
- 意味のあるテストを心がけて作成してください。
- 可読性が高まるようテストスイートを作成
- イコールの検証は`toStrictEqual`を使用する

## **必ず実装する分岐**

- 想定外の値が引数に渡された時のテストも重点的に記載する
- `null`,`undefined`,`error`,引数やPropsの定義外の値
- 仕様上重要・バグが起きやすい境界条件を優先
- 正常系・異常系のどちらも必須で作成
- 境界値のテストも行う
- 関数をテストする場合は、全ての引数のパターンのテスを作成
- 条件分岐がある場合は、全ての分岐を注意深く調査して全てのパターンを作成
- ユーザーが遭遇するであろう、全てのパターンのテストを書く

## **使用するライブラリ**

1. `fishery`
2. `jest-mock-extended`

- **`fishery-js`ライブラリ**

  - `fishery-js`の必要性
    - c
  - コード例

  ```typescript
  // factories/user.factory.ts
  import { Factory } from 'fishery';
  import { faker } from '@faker-js/faker';
  import { prisma } from "@/lib/prisma";
  import { User , UserSettings } from "@prisma/client";

  // ユーザーファクトリーの定義
  export const userFactory = Factory.define<User>(({ sequence, associations , params}) => ({
    const { name = 'Bob Smith' } = params;
    const email = params.email || `${kebabCase(name)}@example.com`;
    // sequenceは連番を生成する関数で、テスト実行時に自動的にインクリメントされます
    id: `user-${sequence}`,
    name: faker.person.fullName(),
    email: faker.internet.email(),
    age: faker.number.int({ min: 18, max: 80 }),
    createdAt: faker.date.past(),
    email: email,
    // associationsを使用して関連オブジェクトを定義
    profile: associations.profile,
  }));

  // コンパイル時に型チェックされるため、安全にテストデータを生成できる
  const user = UserFactory.build(); // User型のオブジェクトが生成される
  const users = UserFactory.buildList(5); // User[]型の配列が生成される

  // 属性をオーバーライドする際も型安全
  const adminUser = UserFactory.build({
    name: '管理者ユーザー',
    isActive: true,
    // age: 'invalid' // TypeScriptエラーが発生するため、バグを未然に防げる
  });

  // 正常なデータの作成
  const validUser = userFactory.build();
  // 異常なデータの作成（emailがundefined）
  const invalidUser = userFactory.build({ email: undefined });
  // または
  const invalidUser2 = createInvalidUserData();
  // テストでPrismaエラーを検証
  test('必須フィールドがない場合はエラーが発生する', async () => {
    const invalidData = createInvalidUserData();
    await expect(prisma.user.create({ data: invalidData }))
      .rejects
      .toThrow(); // Prismaの必須フィールドエラーが発生
  });
  ```

- **`vitest-mock-extended`ライブラリ**

  - `vitest-mock-extended`の必要性

    - 通常のJestのモッキング機能では、複雑なオブジェクト（PrismaClientのような深い階層を持つオブジェクト）を完全にモックするのは困難です。
    - vitest-mock-extendedは、この問題を解決するために作られた専門的なライブラリです。

  - `mockDeep<PrismaClient>()`

    - モック化に使用
    - これは型安全なディープモックを作成します。PrismaClientのすべてのメソッドとプロパティがモックされ、TypeScriptの型情報も保持されます。
    - PrismaClientオブジェクトは以下のような複雑な構造を持っています通常のJestのmock機能では、この各階層を個別にモックする必要がありますが、mockDeepを使用すると、この全ての階層が自動的にモック関数に置き換えられます。- さらに重要なのは、TypeScriptの型情報も完全に保持されることです。

  - `DeepMockProxy<PrismaClient>`

    - モック化した型引数の型定義ができる
    - これは元のPrismaClientと同じインターフェースを持ちながら、すべてのメソッドがモック関数に置き換えられた型です。
    - **DeepMockProxy**は、元のオブジェクトの型構造を保持しながら、全てのメソッドがモック関数になった新しい型を表現します。

  - コード例

    - `export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>`

  - コード例

    ```tsx
    import { prisma } from "@/lib/prisma";
    mockPrisma.user.create.mockResolvedValue(expectedUser); // モック関数の設定
    await mockPrisma.user.create({ data: userData }); // モック関数の実行
    ```

    ```typescript
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
    ```

## **単体テスト**

- 対象:
  - `*.ts`,`*.tsx`,`*.js`に対して、`.test.ts`でユニットテストを書く
  - `.test.ts`がない場合は、テストコードを追加
- ツール:
  - Vitestによるユニットテスト
  - MSW (Mock Service Worker) によるAPI・フェッチのモック
- 方針:
  - 入力値の境界値テスト
  - エラーケースの網羅的テスト

## **テストコード実装のベストプラクティス**

### **1. テストファイル構成**

- テストファイルは対象ファイルと同じディレクトリに配置
- ファイル名は `*.test.ts` または `*.test.tsx` とする
- テストファイル内の構成:
  ```typescript
  // 1. インポート文
  // 2. モック設定
  // 3. テストデータ・ヘルパー関数
  // 4. describe/test ブロック
  ```

### **2. テスト命名規則**

- `describe`: 「テスト対象の機能・コンポーネント名」
- `test/it`: 「should + 期待する動作」の形式
- 例:
  ```typescript
  describe("useReviewSearch", () => {
    test("should update search query when updateSearchQuery is called", () => {
      // テスト内容
    });
  });
  ```

### **3. テストデータ管理**

- `fishery`のファクトリー関数を使用してテストデータを生成
- 最小限のデータセットで意味のあるテストを作成

### **4. モック戦略**

- 外部依存（API、データベース）は必ずモック
- `vi.mock()` を使用してモジュール全体をモック
- `vi.fn()` を使用して関数をモック
- モックの戻り値は明示的に設定

### **5. 非同期テストの書き方**

- `async/await` を使用
- `waitFor` を使用して非同期処理の完了を待機
- タイムアウト設定を適切に行う
- 例:
  ```typescript
  test("should handle async operation", async () => {
    const result = await someAsyncFunction();
    expect(result).toBe(expectedValue);
  });
  ```

### **6. React Hooksのテスト**

- `@testing-library/react-hooks` の `renderHook` を使用
- `act` を使用して状態更新をラップ
- 例:

  ```typescript
  test("should update state correctly", () => {
    const { result } = renderHook(() => useCustomHook());

    act(() => {
      result.current.updateFunction("new value");
    });

    expect(result.current.state).toBe("new value");
  });
  ```

### **7. エラーハンドリングのテスト**

- 正常系だけでなく異常系も必ずテスト
- `expect().toThrow()` を使用してエラーをテスト
- コンソールエラーのモックも考慮

### **8. テストの独立性**

- 各テストは独立して実行可能
- `beforeEach/afterEach` でセットアップ・クリーンアップ
- グローバル状態の影響を受けないよう注意
