# テスト戦略

## **テスト全般**

- TDDを実施する。コード生成する際は、対応するユニットテストを常に生成する。
- コードを追加/修正した際は、`pnpm test`でテストがパスするか常に確認する
- コードカバレッジ
  - 単体テスト: C0は85%以上、C1は70%以上、C2は40%以上を目指す
  - 統合テスト: クリティカルパスの100%カバレッジ
  - E2Eテスト: 主要ユーザーフローの網羅
- `npx vitest --run --coverage`を実行して、現在のカバレッジを取得して、最もカバレッジが上がるコードを考察してからコード実装して、再度カバレッジを取得して数値が向上していることを確認
- 意味のあるテストを心がけて作成してください。
- ユーザーが遭遇するであろう、全てのパターンのテストを書く
- 仕様上重要・バグが起きやすい境界条件を優先

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

## **統合テスト**

- 対象:
  - サーバーアクションとデータベース間の連携
  - Auth.jsとの認証統合
  - SSEの実装とクライアント連携
  - そのほか、.ts,.tsx,.js
- ツール:
  - Prisma + テスト用DBによる結合テスト
    - Prisma 公式は「Docker などで本番と同じ RDBMS を立て、DATABASE_URL="postgres://…" npm run
      test」を推奨しています。トランザクション中にロールバックする prisma.$transaction() を beforeEach で包むとテストデータのクリーンアップが高速
  - SupertestによるAPIエンドポイントテスト
- 方針:
  - 実際のデータベースを使用した結合テスト
  - トランザクション処理の整合性検証
  - 楽観的ロック（OCC）の競合処理テスト
    - OCC テスト
    - Prisma の @updatedAt タイムスタンプや Version カラムを用い、意図的に競合を起こすテストを加えると良いでしょう。

## **E2Eテスト**

- 対象:
  - オークション参加フロー全体
  - 入札から落札までの一連の流れ
  - 通知機能の動作確認
- ツール:
  - Playwright
  - モック時計によるオークション終了テスト
- 方針:
  - クリティカルなユーザーフローの検証
  - マルチユーザーシナリオのテスト
  - モバイル/デスクトップレスポンシブ対応テスト

## **パフォーマンステスト**

- 対象:
  - 全文検索のレスポンス時間
  - 高負荷時のSSE配信パフォーマンス
  - 同時多数入札時のシステム挙動
- ツール
  - k6
  - Next.jsのAnalytics機能
- 方針:
  - 負荷テストシナリオの作成と実行
  - ボトルネックの特定と改善
  - スケーラビリティの検証

## **CI/CD統合**

- GitHub Actionsでの自動テスト実行
  - PRごとのテスト実行
  - メインブランチへのマージ前のゲートとしてのテスト
  - 定期的なE2Eテストの実行

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

- ファクトリー関数を使用してテストデータを生成
- 最小限のデータセットで意味のあるテストを作成
- 例:
  ```typescript
  const createMockReview = (overrides = {}) => ({
    id: "test-id",
    rating: 5,
    comment: "Test comment",
    ...overrides,
  });
  ```

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
