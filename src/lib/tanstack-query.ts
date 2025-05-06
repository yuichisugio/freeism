import { QueryClient } from "@tanstack/react-query";
import { type PersistedClient, type Persister } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Tanstack Queryの設定
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24 * 30, // 30 days
      staleTime: 1000 * 60 * 60 * 24 * 30, // 30 days
    },
  },
});

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
  maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
  retry: 1,
  buster: "0",
};

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
