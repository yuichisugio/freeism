import { useHydrated } from "@tanstack/react-router";

import { authClient } from "./auth-client";

/**
 * 現在のセッション（Better Authの`useSession`）を、hydrationが終わるまでは確認中として返す。
 * 事前生成したトップページでは、セッションの確認がhydrationの途中で終わると、描画が事前生成したHTMLと食い違うため、hydrationの後にセッションに応じた表示へ切り替える。
 * @see https://tanstack.com/router/latest/docs/framework/react/api/router/useHydratedHook
 */
export function useHydratedSession() {
  const session = authClient.useSession();
  const isHydrated = useHydrated();
  return isHydrated ? session : { ...session, data: null, isPending: true };
}
