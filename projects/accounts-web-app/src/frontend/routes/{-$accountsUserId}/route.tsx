import { Outlet, createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { accountsUserIdPrefix } from "../../../shared/constants";
import { UserScopeGate } from "../../features/auth/components/user-scope-gate";

/**
 * 公開プロフィール以外の画面の経路（`/{accountsUserId}/account-links`など）。
 * 先頭のAccountsユーザーIDは表示するユーザーの切替だけに使い、BFF・権限判定はCookieのセッションで行う。
 * IDの無い経路（`/account-links`など）は、ログイン済みなら現在のユーザーのID付きの経路へ移り、未ログインならそのまま表示する。
 * AccountsユーザーIDの形式でない先頭の区切り（`/typo`など）は、存在しない画面として扱う。
 * 画面の無い`/{accountsUserId}`は、そのユーザーの「アカウント連携」画面へ置き換える。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ../../route-tree.test.ts
 */
export const Route = createFileRoute("/{-$accountsUserId}")({
  beforeLoad: ({ params: { accountsUserId }, location }) => {
    if (accountsUserId === undefined) return;
    if (!accountsUserId.startsWith(accountsUserIdPrefix)) throw notFound();
    if (location.pathname === `/${accountsUserId}`) {
      throw redirect({ to: "/{-$accountsUserId}/account-links", params: { accountsUserId }, replace: true });
    }
  },
  component: UserScopedLayout,
});

function UserScopedLayout() {
  return (
    <UserScopeGate>
      <Outlet />
    </UserScopeGate>
  );
}
