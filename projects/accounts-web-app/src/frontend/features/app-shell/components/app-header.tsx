import { Button } from "@heroui/react";
import { Link } from "@tanstack/react-router";

import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { useHydratedSession } from "../../../lib/use-hydrated-session";
import { AccountMenu } from "../../auth/components/account-menu";
import { useLoginDialog } from "../../auth/hooks/use-login-dialog";
import { appShellMessages } from "../messages";

const navigationLinkClassName = "rounded px-2 py-1 text-sm hover:bg-default data-[status=active]:font-semibold";

/**
 * 全画面共通のヘッダー。
 * ロゴとサービス名、管理画面への移動、右端にアカウントのメニュー（未ログインでは「ログインする」）を置く。
 * 管理画面へのリンクは、現在のユーザーのAccountsユーザーID付きの経路にする。
 * ロゴはファビコンと同じSVGを使う。
 * @see ./app-header.test.tsx
 */
export function AppHeader() {
  const messages = useMessages(appShellMessages);
  const common = useMessages(commonMessages);
  const loginDialog = useLoginDialog();
  // 事前生成したトップページと描画を揃えるため、hydrationの後にセッションに応じた表示にする。
  const session = useHydratedSession();
  const userParams = { accountsUserId: session.data?.user.id };

  return (
    <header className="border-b border-default">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <img src="/favicon.svg" alt="" width={24} height={24} />
          {messages.appName}
        </Link>
        <nav aria-label={messages.mainNavigation} className="flex flex-wrap gap-1">
          <Link to="/{-$accountsUserId}/account-links" params={userParams} className={navigationLinkClassName}>
            {messages.accountLinks}
          </Link>
          <Link to="/{-$accountsUserId}/settings" params={userParams} className={navigationLinkClassName}>
            {messages.settings}
          </Link>
          <Link to="/{-$accountsUserId}/developer" params={userParams} className={navigationLinkClassName}>
            {messages.developer}
          </Link>
          <Link to="/{-$accountsUserId}/help" params={userParams} className={navigationLinkClassName}>
            {messages.help}
          </Link>
        </nav>
        <div className="ml-auto">
          {session.isPending ? null : session.data ? (
            <AccountMenu
              currentUser={{ sessionToken: session.data.session.token, displayName: session.data.user.name }}
            />
          ) : (
            <Button size="sm" variant="primary" onPress={() => loginDialog.open()}>
              {common.signIn}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * 全画面共通のフッター。
 * ヘルプ・OSSライセンス・プライバシーポリシー・利用規約へのリンクを置く。
 * AccountsユーザーID付きの画面では、同じユーザーのIDを付けた経路にする。
 */
export function AppFooter() {
  const messages = useMessages(appShellMessages);
  return (
    <footer className="mx-auto flex max-w-6xl flex-wrap gap-4 px-4 py-6 text-sm text-muted">
      <Link to="/{-$accountsUserId}/help" className="underline">
        {messages.help}
      </Link>
      <Link to="/{-$accountsUserId}/licenses" className="underline">
        {messages.licenses}
      </Link>
      <Link to="/{-$accountsUserId}/privacy" className="underline">
        {messages.privacy}
      </Link>
      <Link to="/{-$accountsUserId}/terms" className="underline">
        {messages.terms}
      </Link>
    </footer>
  );
}
