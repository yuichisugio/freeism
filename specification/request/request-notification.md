# 通知の仕様

## 一番重要な点

- 全体・未読・既読のタブごとにバラバラに取得せず、全部を取得してから、CL側で表示しているため、わざと未読と既読を同じ件数を取得する実装にしている
  - できることなら、全体・未読・既読のタブごとにバラバラに取得したい
  - 今の実装を行った時は、TanStack Query
    v5のQueryClientの設定`refetchOnMount: true`が`false`になっていたので、別タブでステータス更新しても、キャッシュがあってステータスが更新されなかった。
  - なので、回避策として、未読と既読を同じ数取得して、一つにまとめてクライアント側に返す実装にした。
  - リファクタリングするなら、キャッシュの設定をちゃんと行えば、理想の「全体・未読・既読のタブごとにバラバラに取得する」こともできると思う
  - TanStack Query v5と`use cache`の両方の設定でキャッシュ更新する設定が必要
  - notionにも反省をまとめていると思うから、あとでまとめたい

## etc

カスタムの`pendingUpdates`メカニズムを、TanStack
Queryの`mutation`、`onMutate`、`onError`、`onSettled`に置き換える。リストクエリは`["notifications", userId, "unread"]`などで管理し、ステータス変更時に`mutate({id, isRead})`を使って楽観的更新を行う。`useInfiniteQuery`を使い、リストの更新を容易にする。`queryClient.invalidateQueries`を使用し、エラーや成功時にキャッシュを更新。ローカルの`allNotifications`に依存せず、クエリ結果でUIを更新する。

思考時間: 1m 7s

以下では **「開いてすぐ“未読”タブに正しい一覧が出ない／既読‑未読トグル直後に UI が変わらない」** という症状を、**TanStack
Query v5 の“楽観的更新 (optimistic update)”** と **queryClient の直接操作**
だけで解消する手順をまとめます。先に結論だけ一文で示すと **「`toggleReadStatus()`
内で即座にキャッシュを書き換え (`setQueriesData`)、バックグラウンドで `mutationFn` を呼び、結果に応じて
`invalidateQueries` で同期する」** が王道です。

---

## 背景と課題整理

1. **ローカル state (`allNotifications`) への書き込みとサーバ同期を分離**

   - トグル時は `allNotifications` だけ変わり、Query Cache は古いまま。
   - そのため **“未読”初期描画** では `useQuery` が返すデータとローカル state が競合し、空表示や古い一覧を残してしまう。
   - サーバへは遅延まとめ送信（`pendingUpdatesRef`）だが、送信直後に **cache を invalidation しても描画ツリーは local
     state を優先** しているのでリストが切り替わらない。

2. **TanStack Query v5 のキャッシュ API が未活用**

   - `queryClient.setQueryData / setQueriesData` で **即時に cache を書き換え**、`onError`
     でロールバックするのが公式推奨 ([TanStack][1])。
   - `invalidateQueries({queryKey:["notifications",userId]})` は key 前方一致で全フィルタを更新できる ([TanStack][2],
     [Stack Overflow][3])。

---

## 解決アプローチの全体像

### ① **pendingUpdatesRef を廃止**し、`useMutation` + **楽観的更新** に一本化

- 状態変更ごとに `toggleReadMutation.mutate({id,isRead})` を呼ぶ。
- `onMutate` で **(a) 既存クエリのフェッチをキャンセル、(b) cache を即時更新** ([TanStack][1], [TanStack][4])。
- UI は cache を購読しているのでワンレンダーで反映。

### ② **onError でロールバック**、**onSettled で invalidateQueries**

- エラー時は `context.prev` を元に `setQueryData` で巻き戻し ([TanStack][1])。
- 成功／失敗にかかわらず `invalidateQueries` で最終同期し、「未読件数」メタもそろえる。

### ③ **リストは Query のデータだけで組み立て**

- `allNotifications` state は不要。
- ページネーションは `useInfiniteQuery` で handling（例後述）。
- フィルタは **queryKey に含める** ➡️ `["notifications", userId, { filter, auctionFilter }]`。

---

## 実装ステップ（TypeScript, React 19, Next.js 15）

### 1. Mutation フックを作成

```ts
// hooks/notification/useToggleRead.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateNotificationStatus } from "@/lib/actions/notification/notification-utilities";

export const useToggleRead = (userId: string | undefined) => {
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ["toggleNotificationStatus"],
    // ❶ サーバ API
    mutationFn: async (vars: { id: string; isRead: boolean }) =>
      updateNotificationStatus([{ notificationId: vars.id, isRead: vars.isRead }]),

    // ❷ 楽観的更新
    onMutate: async (vars) => {
      // クエリ停止
      await qc.cancelQueries({ queryKey: ["notifications", userId] });

      // 直前のキャッシュを保存して rollback 用に返す
      const prevData = qc.getQueriesData<{ pages: NotificationData[][] }>({
        queryKey: ["notifications", userId],
      });

      // 全ページ走査して isRead を書き換え
      qc.setQueriesData({ queryKey: ["notifications", userId] }, (old): typeof old =>
        old
          ? {
              ...old,
              pages: old.pages.map((page) =>
                page.map((n) =>
                  n.id === vars.id ? { ...n, isRead: vars.isRead, readAt: vars.isRead ? new Date() : null } : n,
                ),
              ),
            }
          : old,
      );
      return { prevData };
    },

    // ❸ エラー時 rollback
    onError: (_err, _vars, ctx) => {
      ctx?.prevData.forEach(([key, data]) => qc.setQueryData(key, data));
    },

    // ❹ 成否に関係なく再同期
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["notifications", userId] });
      qc.invalidateQueries({ queryKey: ["hasUnreadNotifications", userId] });
    },
  });
};
```

- `setQueriesData` で **複数フィルタ（all/unread/read）に跨るキャッシュを一気に更新** ([TanStack][4], [GitHub][5])。
- `cancelQueries` → `setQueriesData` は「**キャッシュ→UI→ネット**」の順で走る公式手筋 ([TanStack][1])。

### 2. コンポーネント側の呼び出し

```tsx
// NotificationItem.tsx の抜粋
const { mutate, isPending } = useToggleRead(userId);

const handleStatusButtonClick = (e: React.MouseEvent) => {
  e.stopPropagation();
  mutate({ id: notification.id, isRead: !notification.isRead });
};
```

- **ローカル state に手を触れず**、Mutation が即時で UI を更新する。

### 3. useNotificationList の簡素化

```ts
export function useNotificationList() {
  // 以前の allNotifications, pendingUpdatesRef 系は削除

  const { data, isLoading, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ["notifications", userId, { filter: activeFilter, auction: activeAuctionFilter }],
    queryFn: ({ pageParam = 1 }) => getNotificationsAndUnreadCount(userId, pageParam, ITEMS_PER_PAGE, activeFilter),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _, lastPageParam) =>
      lastPage.notifications.length < ITEMS_PER_PAGE ? undefined : lastPageParam + 1,
    select: (data) => ({
      ...data,
      // 全ページ flatten + ソート
      flat: data.pages.flatMap((p) => p.notifications).sort((a, b) => Number(b.sentAt) - Number(a.sentAt)),
      unreadCount: data.pages[0]?.unreadCount ?? 0,
    }),
    placeholderData: { pages: [], pageParams: [] }, // ちらつき防止 :contentReference[oaicite:6]{index=6}
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 30, // v5 では cacheTime → gcTime :contentReference[oaicite:7]{index=7}
  });

  return {
    notifications: data?.flat ?? [],
    unreadCount: data?.unreadCount ?? 0,
    isLoading,
    loadMore: fetchNextPage,
    hasMore: hasNextPage,
  };
}
```

- **UI は常に Query の値だけを見る**ので「タブ切替後でないとリストが更新されない」問題が消える。

---

## 参考文献・ドキュメント

- TanStack Query v5 楽観的更新ガイド ([TanStack][1])
- キャッシュ即時更新 API (`setQueryData`, `setQueriesData`) ([TanStack][4])
- Query 無効化と部分キー一致 ([TanStack][2], [Stack Overflow][3])
- エラー時ロールバックのパターン ([TanStack][1])
- placeholderData の使いどころ ([TanStack][6])
- v5 での `gcTime` 変更 ([TanStack][7])
- 大規模ページングでの更新戦略 ([GitHub][5])
- ベストプラクティスをまとめた Medium 記事 ([Medium][8])
- DEV Community の基礎解説 ([DEV Community][9])
- GitHub Discussions の実装例 ([GitHub][5])
- React Query 旧ドキュメント（v4）⁠※API 名称の差異確認用 ([TanStack][10], [TanStack][11])
- `Updates from Mutation responses` ガイド ([TanStack][12])

---

## まとめ

- **ポイントは「Mutation を発火した瞬間に Cache を書き換える」**——これで一覧／件数が同時に更新。
- `useInfiniteQuery` + `optimistic update` なら **ローカル state を丸ごと削除**でき、コードも簡潔。
- 既存設計のままでも **`syncNotificationsMutate` を即時起動 + `setQueriesData`** を挿せば症状は解消できる。

これで、「開いた瞬間に“未読”が最新状態で表示される」体験が実現できます。 🎉

[1]:
  https://tanstack.com/query/v5/docs/react/guides/optimistic-updates?utm_source=chatgpt.com
  "Optimistic Updates | TanStack Query React Docs"
[2]:
  https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation?utm_source=chatgpt.com
  "Query Invalidation | TanStack Query React Docs"
[3]:
  https://stackoverflow.com/questions/74770055/react-query-invalidatequeries-partial-match-not-working?utm_source=chatgpt.com
  "React query invalidateQueries partial match not working"
[4]:
  https://tanstack.com/query/latest/docs/reference/QueryClient?utm_source=chatgpt.com
  "QueryClient | TanStack Query Docs"
[5]:
  https://github.com/TanStack/query/discussions/5420?utm_source=chatgpt.com
  "Approach to update data after mutation #5420 - GitHub"
[6]:
  https://tanstack.com/query/v5/docs/framework/react/guides/placeholder-query-data?utm_source=chatgpt.com
  "Placeholder Query Data | TanStack Query React Docs"
[7]:
  https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5?utm_source=chatgpt.com
  "Migrating to TanStack Query v5"
[8]:
  https://medium.com/%40stojanovic.nemanja71/optimistic-updates-in-tanstack-query-v5-dfbcbb124113?utm_source=chatgpt.com
  "Optimistic Updates in Tanstack Query v5 - Medium"
[9]:
  https://dev.to/delisrey/fetching-mutating-data-with-react-query-395f?utm_source=chatgpt.com
  "Fetching & Mutating Data with React-Query - DEV Community"
[10]:
  https://tanstack.com/query/v4/docs/react/guides/optimistic-updates?utm_source=chatgpt.com
  "Optimistic Updates | TanStack Query React Docs"
[11]:
  https://tanstack.com/query/v4/docs/react/guides/query-invalidation?utm_source=chatgpt.com
  "Query Invalidation | TanStack Query React Docs"
[12]:
  https://tanstack.com/query/v4/docs/react/guides/updates-from-mutation-responses?utm_source=chatgpt.com
  "Updates from Mutation Responses | TanStack Query React Docs"

添付されたコードを詳細に分析して、Step by Stepで解説いたします。

## フィルター条件の中身の違いについて

まず、`unreadFilterCondition`と`readFilterCondition`の具体的な内容を確認しましょう。

```typescript
// 未読フィルター条件
const unreadFilterCondition = Prisma.sql`AND (NOT (n."is_read" ? ${userId} AND (n."is_read" -> ${userId} ->> 'isRead')::boolean = TRUE))`;

// 既読フィルター条件
const readFilterCondition = Prisma.sql`AND (n."is_read" ? ${userId} AND (n."is_read" -> ${userId} ->> 'isRead')::boolean = TRUE)`;
```

**これらのフィルター条件は実際には異なります**。違いは以下の通りです：

### unreadFilterCondition（未読フィルター）の詳細解説

```sql
AND (NOT (n."is_read" ? ${userId} AND (n."is_read" -> ${userId} ->> 'isRead')::boolean = TRUE))
```

この条件を分解すると：

- `n."is_read" ? ${userId}`: PostgreSQLのJSONB演算子で、is_readフィールドに指定されたuserIdのキーが存在するかチェック
- `n."is_read" -> ${userId} ->> 'isRead'`: 該当ユーザーのis_readオブジェクト内のisReadプロパティを文字列として取得
- `::boolean = TRUE`: 文字列をboolean型にキャストしてTRUEと比較
- `NOT (...)`: 全体を否定することで「既読ではない」つまり「未読」の条件を作成

### readFilterCondition（既読フィルター）の詳細解説

```sql
AND (n."is_read" ? ${userId} AND (n."is_read" -> ${userId} ->> 'isRead')::boolean = TRUE)
```

こちらは：

- `NOT`が付いていないため、条件が満たされる場合は「既読」
- ユーザーIDがis_readに存在し、かつisReadがTRUEの場合にマッチ

## 2回に分けて取得する意味と問題点

### 現在の実装の動作

```typescript
for (const filterCondition of [unreadFilterCondition, readFilterCondition]) {
  const notificationsQuery = Prisma.sql`
    // SELECT文...
    WHERE ${commonWhereClause} ${filterCondition}
    ORDER BY n."sent_at" DESC, n.id DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const currentBatch = await prisma.$queryRaw<RawNotificationFromDB[]>(notificationsQuery);
  if (Array.isArray(currentBatch)) {
    allRawNotificationsFromDb.push(...currentBatch);
  }
}
```

この実装では：

1. **1回目**：未読の通知を`LIMIT 20 OFFSET 0`で取得
2. **2回目**：既読の通知を同じく`LIMIT 20 OFFSET 0`で取得
3. 結果を配列に結合

**問題1: ページネーションの破綻**
両方のクエリで同じ`offset`を使用しているため、ページネーションが正しく動作しません。例えば、page=2の場合：

- 未読通知：21-40件目を取得
- 既読通知：21-40件目を取得
- 結果：最大40件取得される可能性があり、期待される20件を超える

**問題2: データの重複と非効率性**

```typescript
const uniqueRawNotifications = Array.isArray(allRawNotificationsFromDb)
  ? Array.from(new Map(allRawNotificationsFromDb.map((n) => [n.id, n])).values())
  : [];
```

重複除去処理が必要になっているのは、実装に問題があることを示しています。

### より適切な実装方法

この要件であれば、以下のような単一クエリの方が適切です：

```typescript
const notificationsQuery = Prisma.sql`
  SELECT 
    // SELECT句は同じ...
  FROM "Notification" n
  LEFT JOIN "User" u ON n."sender_user_id" = u.id
  LEFT JOIN "Group" g ON n."group_id" = g.id  
  LEFT JOIN "Task" t ON n."task_id" = t.id
  WHERE ${commonWhereClause}
  ORDER BY 
    -- 未読を優先してソート
    CASE 
      WHEN NOT (n."is_read" ? ${userId} AND (n."is_read" -> ${userId} ->> 'isRead')::boolean = TRUE) 
      THEN 0 
      ELSE 1 
    END,
    n."sent_at" DESC, 
    n.id DESC
  LIMIT ${limit} OFFSET ${offset}
`;
```

この方法なら：

- 正確なページネーション
- 未読優先の表示
- 単一クエリで効率的
- 重複の心配なし

### 結論

現在の実装で2回に分けて取得する意味は、おそらく「未読通知を優先表示したい」という意図があったと推測されますが、実装に問題があり期待通りに動作していない可能性が高いです。単一クエリでソート条件を工夫する方が、より確実で効率的な実装になります。
