import type { ReviewSearchParams } from "@/components/review-search/review-search";
import type { AuctionCreatedTabFilter, AuctionListingsConditions, FilterCondition } from "@/types/auction-types";
import type { Result } from "@/types/general-types";
import type { AllUserGroupTable, MyGroupTable, MyTaskTableConditions, TableConditions } from "@/types/group-types";
import type { ReviewPosition } from "@prisma/client";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { type PersistedClient, type Persister } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Tanstack Queryのキャッシュキーのファクトリー関数
 * オブジェクトは順序が異なることがあり、キャッシュキーが一致しない場合があるため、文字列にしている
 */
export const queryCacheKeys = {
  Notification: {
    _root: ["notification"] as const,
    all: () => [...queryCacheKeys.Notification._root] as const,
    userAllNotifications: (userId: string) =>
      [...queryCacheKeys.Notification.all(), "userAllNotifications", "userId:", userId] as const,
    hasUnreadNotifications: (userId: string) =>
      [...queryCacheKeys.Notification.userAllNotifications(userId), "hasUnreadNotifications"] as const,
    prepareCreateNotificationForm: (userId: string, isAppOwner: boolean, isGroupOwner: boolean) =>
      [
        ...queryCacheKeys.Notification.userAllNotifications(userId),
        "prepareCreateNotificationForm",
        "isAppOwner:",
        isAppOwner,
        "isGroupOwner:",
        isGroupOwner,
      ] as const,
  },

  userSettings: {
    _root: ["userSettings"] as const,
    all: () => [...queryCacheKeys.userSettings._root] as const,
    userAll: (userId: string) => [...queryCacheKeys.userSettings.all(), userId] as const,
  },

  watchlist: {
    _root: ["watchlist"] as const,
    all: () => [...queryCacheKeys.watchlist._root] as const,
    userAll: (userId: string) => [...queryCacheKeys.watchlist.all(), userId] as const,
    userAuction: (auctionId: string, userId: string) =>
      [...queryCacheKeys.watchlist.userAll(userId), auctionId] as const,
    update: (userId: string) => [...queryCacheKeys.watchlist.userAll(userId), "update"] as const,
  },

  auction: {
    _root: ["auction"] as const,
    allListings: () => [...queryCacheKeys.auction._root, "allListings"] as const,
    userAllListings: (userId: string, listingsConditions: AuctionListingsConditions, userGroupIds: string[]) =>
      [
        ...queryCacheKeys.auction.allListings(),
        JSON.stringify(listingsConditions),
        userId,
        ...[...userGroupIds].sort(),
      ] as const,
    suggestions: (searchQuery: string, userId: string, userGroupIds: string[]) =>
      [...queryCacheKeys.auction._root, "suggestions", searchQuery, userId, ...[...userGroupIds].sort()] as const,
    messages: (auctionId: string, isDisplayAfterEnd: boolean, auctionEndDate: Date) =>
      [...queryCacheKeys.auction._root, "messages", auctionId, isDisplayAfterEnd, auctionEndDate] as const,
    detail: (auctionId: string) => [...queryCacheKeys.auction._root, "detail", auctionId] as const,
    autoBid: (auctionId: string, userId: string, currentHighestBid: number) =>
      [...queryCacheKeys.auction._root, "autoBid", auctionId, userId, currentHighestBid] as const,
    bid: (auctionId: string) => [...queryCacheKeys.auction._root, "bid", auctionId] as const,
    history: () => [...queryCacheKeys.auction._root, "history"] as const,
    historyBids: (userId: string, page: number, itemPerPage: number) =>
      [...queryCacheKeys.auction.history(), "bids", userId, page, itemPerPage] as const,
    historyBidsCount: (userId: string) => [...queryCacheKeys.auction.history(), "bidsCount", userId] as const,
    historyWon: (userId: string, page: number, itemPerPage: number, wonStatus: string) =>
      [...queryCacheKeys.auction.history(), "won", userId, page, itemPerPage, wonStatus] as const,
    historyWonCount: (userId: string, wonStatus: string) =>
      [...queryCacheKeys.auction.history(), "wonCount", userId, wonStatus] as const,
    historyCreated: (
      userId: string,
      page: number,
      itemPerPage: number,
      filter: AuctionCreatedTabFilter[],
      filterCondition: FilterCondition,
    ) =>
      [
        ...queryCacheKeys.auction.history(),
        "created",
        userId,
        page,
        itemPerPage,
        ...[...filter].sort(),
        filterCondition,
      ] as const,
    historyCreatedCount: (userId: string, filter: AuctionCreatedTabFilter[], filterCondition: FilterCondition) =>
      [...queryCacheKeys.auction.history(), "createdCount", userId, ...[...filter].sort(), filterCondition] as const,
    historyCreatedDetail: (userId: string, auctionId: string) =>
      [...queryCacheKeys.auction.history(), "createdDetail", userId, auctionId] as const,
    winningRating: (winnerId: string) => [...queryCacheKeys.auction._root, "winningRating", winnerId] as const,
    wonDetail: (auctionId: string, userId: string) =>
      [...queryCacheKeys.auction._root, "wonDetail", auctionId, userId] as const,
    displayUserInfo: (auctionId: string, reviewPosition: ReviewPosition) =>
      [...queryCacheKeys.auction._root, "displayUserInfo", auctionId, reviewPosition] as const,
  },

  table: {
    _root: ["table"] as const,
    all: () => [...queryCacheKeys.table._root] as const,
    allGroup: () => [...queryCacheKeys.table.all(), "allGroup"] as const, // exact: falseでキャッシュを無効化するため、キャッシュキーには"group"を含める
    allGroupConditions: (tableConditions: TableConditions<AllUserGroupTable>, userId: string) =>
      [...queryCacheKeys.table.allGroup(), JSON.stringify(tableConditions), userId] as const,
    allGroupCount: (searchQuery: string, isJoined: "isJoined" | "notJoined" | "all", userId: string) =>
      [...queryCacheKeys.table.allGroup(), "count", searchQuery, isJoined, userId] as const,
    myGroup: () => [...queryCacheKeys.table.all(), "myGroup"] as const,
    myGroupConditions: (tableConditions: TableConditions<MyGroupTable>, userId: string) =>
      [...queryCacheKeys.table.myGroup(), JSON.stringify(tableConditions), userId] as const,
    myGroupCount: (searchQuery: string | null, userId: string) =>
      [...queryCacheKeys.table.myGroup(), "count", searchQuery ?? "", userId] as const,
    myTask: () => [...queryCacheKeys.table.all(), "myTask"] as const,
    myTaskConditions: (tableConditions: MyTaskTableConditions, currentUserId: string) =>
      [...queryCacheKeys.table.myTask(), JSON.stringify(tableConditions), currentUserId] as const,
  },

  tasks: {
    _root: ["tasks"] as const,
    all: () => [...queryCacheKeys.tasks._root] as const,
    byGroupId: (groupId: string) => [...queryCacheKeys.tasks.all(), groupId] as const,
    byGroupIdWithConditions: <T = unknown>(groupId: string, tableConditions: TableConditions<T>) =>
      [...queryCacheKeys.tasks.byGroupId(groupId), JSON.stringify(tableConditions)] as const,
    prepareCreateTaskForm: () => [...queryCacheKeys.tasks.all(), "prepareCreateTaskForm"] as const,
    taskById: (taskId: string) => [...queryCacheKeys.tasks.all(), "taskById", taskId] as const,
  },

  users: {
    _root: ["users"] as const,
    all: () => [...queryCacheKeys.users._root] as const,
    groups: (userId: string) => [...queryCacheKeys.users.all(), "groups", userId] as const,
    joinedGroupIds: (userId: string) => [...queryCacheKeys.users.all(), "joinedGroupIds", userId] as const,
  },

  permission: {
    _root: ["permission"] as const,
    appOwner: (userId: string) => [...queryCacheKeys.permission._root, "appOwnerPermission", userId] as const,
    groupPermission: (groupId: string) =>
      [...queryCacheKeys.permission._root, "groupOwnerPermission", groupId] as const,
    groupOwner: (groupId: string, userId: string) =>
      [...queryCacheKeys.permission.groupPermission(groupId), "owner", userId] as const,
    oneGroupOwner: (userId: string) => [...queryCacheKeys.permission._root, "oneGroupOwner", userId] as const,
    members: (groupId: string) => [...queryCacheKeys.permission.groupPermission(groupId), "members"] as const,
  },

  review: {
    _root: ["review"] as const,
    all: () => [...queryCacheKeys.review._root] as const,
    searchAndTab: (searchParams: ReviewSearchParams) =>
      [...queryCacheKeys.review.all(), "searchAndTab", searchParams.page, searchParams.q, searchParams.tab] as const,
    suggestions: (query: string) => [...queryCacheKeys.review.all(), "suggestions", query] as const,
  },
} as const;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Tanstack QueryのuseQueryエラーハンドリング
 * useQueryでエラーが発生した際に、デフォの挙動を指定する
 * useQueryは、それぞれにonErrorを指定できず、ここで指定することで、複数箇所で同じキャッシュキーのエラー処理のトースト重複を避けられるらしい
 */
const appQueryCache = new QueryCache({
  onError: (error: Error) => {
    console.error(error);
    toast.error(error.message);
  },
  onSuccess: (data: unknown, meta: unknown) => {
    // dataがResult型であることを確認してから処理
    // meta.toastがtrueの場合のみトーストを表示する
    if (
      meta &&
      typeof meta === "object" &&
      "toast" in meta &&
      meta.toast === true &&
      data &&
      typeof data === "object" &&
      "success" in data &&
      "message" in data
    ) {
      const result = data as Result<unknown>;
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    }
  },
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Tanstack QueryのuseMutationエラーハンドリング
 */
const appMutationCache = new MutationCache({
  onError: (error: Error) => {
    // 想定外のエラーを出力
    console.error(error);
    toast.error(error.message);
  },
  onSuccess: (data: unknown) => {
    // dataがResult型であることを確認してから処理
    if (data && typeof data === "object" && "success" in data && "message" in data) {
      const result = data as Result<unknown>;
      // 成功時はトーストを表示
      if (result.success) {
        toast.success(result.message);
      } else {
        // バリデーションエラーなどの想定内のエラーを通知
        toast.error(result.message);
      }
    }
  },
  onSettled: (_data, _error, _variables, _context, mutation) => {
    // metaタグに渡したキャッシュキーをinvalidateする
    if (mutation?.meta?.invalidateCacheKeys && Array.isArray(mutation.meta.invalidateCacheKeys)) {
      mutation.meta.invalidateCacheKeys.forEach((key: { queryKey: readonly unknown[]; exact: boolean }) => {
        void queryClient.invalidateQueries(key);
      });
    }
  },
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Tanstack Queryの設定
 */
export const queryClient = new QueryClient({
  queryCache: appQueryCache,
  mutationCache: appMutationCache,
  defaultOptions: {
    queries: {
      gcTime: Infinity,
      staleTime: Infinity,
      networkMode: "online",
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: false,
      retryDelay: 0,
      retryOnMount: false,
      refetchInterval: false,
      refetchIntervalInBackground: false,
      throwOnError: true,
    },
  },
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Tanstack Queryの永続化
 */
function createIDBPersister(idbValidKey: IDBValidKey = "reactQuery") {
  return {
    persistClient: async (client: PersistedClient) => {
      await set(idbValidKey, client);
    },
    restoreClient: async () => {
      return await get<PersistedClient>(idbValidKey);
    },
    removeClient: async () => {
      await del(idbValidKey);
    },
  } satisfies Persister;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Tanstack Queryの永続化
 */
const persister = createIDBPersister("react-query-persister");

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Tanstack Queryの永続化オプション
 */
export const persistOptions = {
  persister: persister,
  maxAge: Infinity,
  retry: 1,
  buster: "0",
};
