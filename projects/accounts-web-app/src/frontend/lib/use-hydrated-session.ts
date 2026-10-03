import { useHydrated } from "@tanstack/react-router";
import { useState } from "react";

import { authClient } from "./auth-client";

/**
 * 現在のセッション（Better Authの`useSession`）を、hydrationが終わるまでは確認中として返す。
 * 事前生成したトップページでは、セッションの確認がhydrationの途中で終わると、描画が事前生成したHTMLと食い違うため、hydrationの後にセッションに応じた表示へ切り替える。
 * Better Authはフォーカス時などの再取得で、未ログインの間は確認中（`isPending`）へ戻すため、一度確認を終えた後は確認中にせず、未ログインの表示を保つ。
 * @see https://tanstack.com/router/latest/docs/framework/react/api/router/useHydratedHook
 * @see ./use-hydrated-session.test.tsx
 */
export function useHydratedSession() {
  const session = authClient.useSession();
  const isHydrated = useHydrated();
  const [hasResolved, setHasResolved] = useState(false);
  if (!session.isPending && !hasResolved) setHasResolved(true);

  if (!isHydrated) return { ...session, data: null, isPending: true };
  return hasResolved ? { ...session, isPending: false } : session;
}
