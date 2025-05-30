# Vitest セットアップ完了ガイド

## 📋 設定完了項目

### ✅ インストール済みライブラリ

- `vitest@^3.1.4` - テストランナー
- `@vitejs/plugin-react@^4.5.0` - Reactサポート
- `@testing-library/react@^16.3.0` - Reactコンポーネントテスト
- `@testing-library/jest-dom@^6.6.3` - DOM マッチャー
- `@testing-library/user-event@^14.6.1` - ユーザーインタラクション
- `@vitest/coverage-v8@^3.1.4` - カバレッジ測定
- `jsdom@^26.1.0` - DOM環境
- `msw@^2.8.4` - APIモック
- `happy-dom@^17.4.7` - 軽量DOM環境

### ✅ 設定ファイル

- `vitest.config.ts` - Vitest設定
- `src/test/setup.ts` - テストセットアップ
- `src/test/mocks/handlers.ts` - MSWハンドラー
- `src/test/mocks/server.ts` - MSWサーバー
- `src/test/utils.tsx` - テストユーティリティ

### ✅ TypeScript設定

- `tsconfig.json` に `"types": ["vitest/globals"]` を追加

### ✅ package.json スクリプト

```json
{
  "test": "vitest run --passWithNoTests",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:ui": "vitest --ui"
}
```

## 🚀 使用方法

### 基本テスト実行

```bash
pnpm test
```

### ウォッチモード

```bash
pnpm test:watch
```

### カバレッジ測定

```bash
pnpm test:coverage
```

### UI モード

```bash
pnpm test:ui
```

## 📁 テストファイル構造

```
src/
├── test/
│   ├── setup.ts              # テストセットアップ
│   ├── utils.tsx              # テストユーティリティ
│   ├── sample.test.ts         # サンプルテスト
│   └── mocks/
│       ├── handlers.ts        # MSWハンドラー
│       └── server.ts          # MSWサーバー
└── components/
    └── [component]/
        └── [component].test.tsx  # コンポーネントテスト
```

## 📝 テスト作成例

### 基本的なユニットテスト

```typescript
import { describe, test, expect } from "vitest";

describe("MyFunction", () => {
  test("should return correct value", () => {
    expect(myFunction(1, 2)).toBe(3);
  });
});
```

### Reactコンポーネントテスト

```typescript
import { render, screen } from '@/test/utils'
import { MyComponent } from './MyComponent'

describe('MyComponent', () => {
  test('should render correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

## 🎯 カバレッジ目標値

- **Lines**: 85%
- **Functions**: 70%
- **Branches**: 40%
- **Statements**: 85%

## 🔧 設定詳細

### Vitest設定 (vitest.config.ts)

- **環境**: jsdom
- **セットアップファイル**: `./src/test/setup.ts`
- **グローバル**: 有効
- **カバレッジプロバイダー**: v8
- **タイムアウト**: 10秒

### 除外ファイル

- `node_modules/`
- `src/test/`
- `**/*.d.ts`
- `**/*.config.*`
- `**/coverage/**`
- `**/.next/**`
- `**/prisma/**`
- `**/scripts/**`

## 🚨 注意事項

1. **MSWサーバー**: 現在は基本設定のみ。必要に応じてハンドラーを追加してください。
2. **環境変数**: テスト環境固有の設定は `vitest.config.ts` で行ってください。
3. **Next.js モック**: `next/navigation` と `next/image` は自動的にモックされます。

## 📚 参考リンク

- [Vitest公式ドキュメント](https://vitest.dev/)
- [Testing Library公式ドキュメント](https://testing-library.com/)
- [MSW公式ドキュメント](https://mswjs.io/)

---

✅ **Vitestの設定が完了しました！** テストの作成を開始できます。
