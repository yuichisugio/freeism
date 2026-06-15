# 命名規則

このプロジェクトでは、慣習に合わせて、用途ごとに命名を分ける。

## 基本ルール

| 対象                 | 命名規則                | 例                                             |
| -------------------- | ----------------------- | ---------------------------------------------- |
| ファイル名           | `kebab-case`            | `create-group-form.tsx`                        |
| ディレクトリ名       | `kebab-case`            | `group-list`, `auto-bid`                       |
| 変数                 | `camelCase`             | `maxBidAmount`, `currentHighestBidderId`       |
| 関数                 | `camelCase`             | `createGroup`, `setAutoBid`                    |
| React Hooks          | `use` + `PascalCase`    | `useAuctionBidSSE`, `useReviewSearch`          |
| React コンポーネント | `PascalCase`            | `CreateGroupForm`, `UserCombobox`              |
| 型                   | `PascalCase`            | `PromiseResult`, `CreateGroupFormData`         |
| interface            | `PascalCase`            | `BadgeProps`, `PaginationLinkProps`            |
| Prisma model         | `PascalCase`            | `User`, `GroupMembership`, `AuctionReview`     |
| Prisma field         | `camelCase`             | `createdAt`, `userId`, `currentHighestBid`     |
| Prisma enum value    | `SCREAMING_SNAKE_CASE`  | `AUCTION_ACTIVE`, `WEB_PUSH`, `POINTS_AWARDED` |
| 環境変数             | `SCREAMING_SNAKE_CASE`  | `DATABASE_URL`, `FREEISM_APP_API_SECRET_KEY`   |
| npm scripts          | `:` 区切り + kebab-case | `typecheck:rm`, `prisma:dev:migrate`           |

## ファイル名

ファイル名は原則 `kebab-case` にする。

```text
auction-listing.ts
create-group-form.tsx
use-auction-bid-sse.ts
bulk-update-task-status.test.ts
response-format.md
```

テストファイルは、対象ファイル名に `.test` を付ける。

```text
button.tsx
button.test.tsx

route.ts
route.test.ts
```

Next.js App Router の予約ファイル名は Next.js の規約に従う。

```text
page.tsx
layout.tsx
loading.tsx
error.tsx
global-error.tsx
not-found.tsx
route.ts
```

動的ルートは `[]` を使う。

```text
[id]
[auctionId]
[...nextauth]
```

## TypeScript

変数、関数、引数、props、オブジェクトキーは `camelCase` にする。

```ts
const maxBidAmount = 100;
const isPushEnabled = true;

export async function setAutoBid(auctionId: string, maxBidAmount: number, bidIncrement: number) {
  // ...
}
```

boolean は意味が分かる接頭辞を使う。

```ts
const isActive = true;
const hasUnreadNotifications = false;
const canEditTask = true;
```

型、props 型、戻り値型は `PascalCase` にする。

```ts
type UseAuctionBidSSEReturn = {
  loading: boolean;
  error: string | null;
};

export type CreateGroupFormData = z.infer<typeof createGroupSchema>;
```

## React

React コンポーネントは `PascalCase` にする。

```tsx
export function UserCombobox() {
  return null;
}
```

コンポーネントファイル名は `kebab-case` にする。

```text
create-group-form.tsx -> CreateGroupForm
theme-toggle.tsx -> ThemeToggle
user-combobox.tsx -> UserCombobox
```

Hooks は `use` から始める。

```ts
export function useAuctionBidSSE() {
  // ...
}
```

Hooks のファイル名も `use-` から始める。

```text
use-auction-bid-sse.ts
use-create-notification.ts
use-pagination.ts
```

## Server Action

Server Action のファイル名は機能単位の `kebab-case` にする。

```text
actions/group/group.ts
actions/task/bulk-update-task-status.ts
actions/auction/auto-bid/set-auto-bid.ts
```

export する関数名は `camelCase` にする。

```ts
export async function createGroup() {}
export async function bulkUpdateTaskStatus() {}
export async function setAutoBid() {}
```

キャッシュを使う取得関数は、`getCached...` または `cached...` を使う。

```ts
getCachedAuctionByAuctionId;
cachedGetAuctionListingsAndCount;
```

## 定数

複数ファイルから参照する定数オブジェクトは `SCREAMING_SNAKE_CASE` にする。

```ts
export const AUCTION_CONSTANTS = {
  DEFAULT_AUCTION_IMAGE_URL: "/images/default-auction-image.png",
};
```

スキーマ、query key、variant helper などの通常の値は `camelCase` にする。

```ts
export const createGroupSchema = z.object({});
export const queryCacheKeys = {};
const buttonVariants = cva("");
```

## Prisma / DB

Prisma model と enum 名は `PascalCase` にする。

```prisma
model User {}
model GroupMembership {}

enum TaskStatus {}
```

Prisma field は `camelCase` にする。

```prisma
createdAt
userId
currentHighestBidderId
```

DB カラム名は `@map` で `snake_case` にする。

```prisma
createdAt              DateTime @default(now()) @map("created_at")
currentHighestBidderId String?  @map("current_highest_bidder_id")
```

Prisma enum value は `SCREAMING_SNAKE_CASE` にする。

```prisma
enum TaskStatus {
  PENDING
  AUCTION_ACTIVE
  TASK_COMPLETED
}
```

## 環境変数

環境変数は `SCREAMING_SNAKE_CASE` にする。

```env
DATABASE_URL=
AUTH_SECRET=
FREEISM_APP_API_SECRET_KEY=
```

クライアントへ公開する値は `NEXT_PUBLIC_` prefix を付ける。

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_ENABLE_IMAGE_UPLOAD=
```

secret、token、private key には `NEXT_PUBLIC_` を付けない。

## package / workspace

package 名と workspace 配下のプロジェクト名は小文字の `kebab-case` にする。

```json
{
  "name": "web-app"
}
```

workspace 配下のプロジェクトは `projects/*` に置く。

```yaml
packages:
  - projects/*
```

## Docs

Markdown ファイル名は `kebab-case` にする。

```text
naming-convention.md
response-format.md
image-upload-cloudflare-r2.md
```

日本語版 index は既存構成に合わせて `index.ja.md` を使う。
