import { useEffect, useState } from "react";
import type * as v from "valibot";

import { requestBff } from "../../../lib/api-client";

type ResourceState<TData> = {
  data: TData | null;
  error: unknown;
  isLoading: boolean;
};

/**
 * 画面表示時にBFFから1件のデータを読み込む。
 * `reload`で再取得し、再取得中も前回のデータを表示し続ける。
 * `schema`は再描画で変わらないモジュール定数を渡す。
 */
export function useBffResource<TSchema extends v.GenericSchema>(path: string, schema: TSchema) {
  type Data = v.InferOutput<TSchema>;
  const [state, setState] = useState<ResourceState<Data>>({ data: null, error: null, isLoading: true });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setState((previous) => ({ ...previous, error: null, isLoading: true }));
    requestBff(path, schema).then(
      (data) => {
        if (isCurrent) setState({ data, error: null, isLoading: false });
      },
      (error: unknown) => {
        if (isCurrent) setState({ data: null, error, isLoading: false });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [path, schema, reloadCount]);

  return {
    ...state,
    reload: () => setReloadCount((count) => count + 1),
    /** 更新操作の応答で、再取得せずに表示中のデータを置き換える。 */
    replaceData: (data: Data) => setState({ data, error: null, isLoading: false }),
  };
}
