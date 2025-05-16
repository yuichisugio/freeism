import type { AuctionListingsConditions } from "@/types/auction-types";
import type { AllUserGroupTable, MyGroupTable, MyTaskTableConditions, TableConditions } from "@/types/group-types";
import { QueryClient } from "@tanstack/react-query";
import { type PersistedClient, type Persister } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Tanstack Queryのキャッシュキーのファクトリー関数
 * オブジェクトは順序が異なることがあり、キャッシュキーが一致しない場合があるため、文字列にしている
 */
export const queryCacheKeys = {
  Notification: {
    _root: ["notification"] as const,
    all: () => [...queryCacheKeys.Notification._root] as const,
    userAllNotifications: (userId: string) => [...queryCacheKeys.Notification.all(), userId] as const,
    hasUnreadNotifications: (userId: string) => [...queryCacheKeys.Notification.userAllNotifications(userId), "hasUnreadNotifications"] as const,
  },

  userSettings: {
    _root: ["userSettings"] as const,
    all: () => [...queryCacheKeys.userSettings._root] as const,
    userAll: (userId: string) => [...queryCacheKeys.userSettings.all(), userId] as const,
    update: (userId: string) => [...queryCacheKeys.userSettings.userAll(userId), "update"] as const,
  },

  watchlist: {
    _root: ["watchlist"] as const,
    all: () => [...queryCacheKeys.watchlist._root] as const,
    userAll: (userId: string) => [...queryCacheKeys.watchlist.all(), userId] as const,
    userAuction: (auctionId: string, userId: string) => [...queryCacheKeys.watchlist.userAll(userId), auctionId] as const,
    update: (userId: string) => [...queryCacheKeys.watchlist.userAll(userId), "update"] as const,
  },

  auction: {
    _root: ["auction"] as const,
    allListings: () => [...queryCacheKeys.auction._root, "allListings"] as const,
    userAllListings: (userId: string, listingsConditions: AuctionListingsConditions) =>
      [...queryCacheKeys.auction.allListings(), JSON.stringify(listingsConditions), userId] as const,
    messages: (auctionId: string) => [...queryCacheKeys.auction._root, "messages", auctionId] as const,
    detail: (auctionId: string) => [...queryCacheKeys.auction._root, "detail", auctionId] as const,
    autoBid: (auctionId: string, userId: string, currentHighestBid: number) =>
      [...queryCacheKeys.auction._root, "autoBid", auctionId, userId, currentHighestBid] as const,
  },

  table: {
    _root: ["table"] as const,
    all: () => [...queryCacheKeys.table._root] as const,
    allGroup: () => [...queryCacheKeys.table.all(), "allGroup"] as const, // exact: falseでキャッシュを無効化するため、キャッシュキーには"group"を含める
    allGroupConditions: (tableConditions: TableConditions<AllUserGroupTable>) =>
      [...queryCacheKeys.table.allGroup(), JSON.stringify(tableConditions)] as const,
    myGroup: () => [...queryCacheKeys.table.all(), "myGroup"] as const,
    myGroupConditions: (tableConditions: TableConditions<MyGroupTable>) =>
      [...queryCacheKeys.table.myGroup(), JSON.stringify(tableConditions)] as const,
    myTask: () => [...queryCacheKeys.table.all(), "myTask"] as const,
    myTaskConditions: (tableConditions: MyTaskTableConditions) => [...queryCacheKeys.table.myTask(), JSON.stringify(tableConditions)] as const,
  },

  tasks: {
    _root: ["tasks"] as const,
    all: () => [...queryCacheKeys.tasks._root] as const,
    byGroupId: (groupId: string) => [...queryCacheKeys.tasks.all(), groupId] as const,
    byGroupIdWithConditions: <T = unknown>(groupId: string, tableConditions: TableConditions<T>) =>
      [...queryCacheKeys.tasks.byGroupId(groupId), JSON.stringify(tableConditions)] as const,
  },

  users: {
    _root: ["users"] as const,
    all: () => [...queryCacheKeys.users._root] as const,
  },

  permission: {
    _root: ["permission"] as const,
    appOwner: (userId: string) => [...queryCacheKeys.permission._root, "appOwnerPermission", userId] as const,
    groupPermission: (groupId: string) => [...queryCacheKeys.permission._root, "groupOwnerPermission", groupId] as const,
    groupOwner: (groupId: string, userId: string) => [...queryCacheKeys.permission.groupPermission(groupId), "owner", userId] as const,
    members: (groupId: string) => [...queryCacheKeys.permission.groupPermission(groupId), "members"] as const,
  },
} as const;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Tanstack Queryの設定
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: Infinity,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchInterval: false,
      refetchIntervalInBackground: false,
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
