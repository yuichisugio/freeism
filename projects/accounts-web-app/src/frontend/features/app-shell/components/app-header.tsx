import { createLink, Link } from "@tanstack/react-router";
import type { ComponentPropsWithRef } from "react";

import { useMessages } from "../../../lib/i18n/i18n-provider";
import { useHydratedSession } from "../../../lib/use-hydrated-session";
import { AccountMenu } from "../../auth/components/account-menu";
import { appShellMessages } from "../messages";
import { LogoIcon } from "./icons";

/**
 * 現在のページの印（`aria-current`）を付けないリンク。
 * ロゴは「トップ」のタブと同じ行き先のため、現在のページの印はタブだけに付ける。
 */
const UnmarkedLink = createLink(function UnmarkedAnchor({
  "aria-current": _ariaCurrent,
  ...props
}: ComponentPropsWithRef<"a">) {
  return <a {...props} />;
});

const tabClassName =
  "rounded-full px-4 py-1 text-sm whitespace-nowrap text-muted hover:text-foreground hover:no-underline aria-[current=page]:bg-accent-soft aria-[current=page]:font-medium aria-[current=page]:text-accent";

/**
 * 全画面共通のヘッダー。
 * 左にロゴと「Freeism Accounts」、中央に「トップ」「アカウント連携」「その他」のタブ、右端にログイン済みなら人のアイコンのアカウント切替メニューを置く。
 * 未ログインでは右端に何も置かない。
 * 画面へのタブは、現在のユーザーのAccountsユーザーID付きの経路にする。
 * 640px 未満ではタブを2段目の中央に回し、はみ出すときだけ横にスクロールする。
 * 同意画面は`hasTabs={false}`でタブを置かない。
 * @see ../../../../../docs/specification/v0.1/design-system.ja.md
 * @see ./app-header.test.tsx
 */
export function AppHeader({ hasTabs = true }: { hasTabs?: boolean }) {
  const messages = useMessages(appShellMessages);
  // 事前生成したトップページと描画を揃えるため、hydrationの後にセッションに応じた表示にする。
  const session = useHydratedSession();
  const userParams = { accountsUserId: session.data?.user.id };

  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-6 py-4 max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-3 max-sm:px-4 max-sm:py-3">
      <UnmarkedLink
        to="/"
        className="flex items-center gap-2 justify-self-start font-display text-lg font-bold text-foreground hover:no-underline"
      >
        <LogoIcon className="size-7" />
        {messages.appName}
      </UnmarkedLink>
      {hasTabs ? (
        <nav
          aria-label={messages.mainNavigation}
          className="flex justify-center gap-0.5 rounded-full border border-border bg-surface p-1 max-sm:col-span-full max-sm:row-start-2 max-sm:max-w-full max-sm:justify-self-center max-sm:justify-center-safe max-sm:overflow-x-auto max-sm:[scrollbar-width:none]"
        >
          <Link to="/" activeOptions={{ exact: true }} className={tabClassName}>
            {messages.home}
          </Link>
          <Link to="/{-$accountsUserId}/account-links" params={userParams} className={tabClassName}>
            {messages.accountLinks}
          </Link>
          <Link to="/{-$accountsUserId}/settings" params={userParams} className={tabClassName}>
            {messages.other}
          </Link>
        </nav>
      ) : null}
      <div className="col-start-3 flex items-center justify-self-end max-sm:col-start-2 max-sm:row-start-1">
        {session.data ? (
          <AccountMenu
            currentUser={{
              sessionToken: session.data.session.token,
              accountsUserId: session.data.user.id,
              displayName: session.data.user.name,
            }}
          />
        ) : null}
      </div>
    </header>
  );
}

/**
 * 全画面共通のフッター。
 * 使い方・OSSライセンス・プライバシーポリシー・利用規約へのリンクを中央に並べる。
 * AccountsユーザーID付きの画面では、同じユーザーのIDを付けた経路にする。
 */
export function AppFooter() {
  const messages = useMessages(appShellMessages);
  const footerLinkClassName = "text-muted aria-[current=page]:font-medium aria-[current=page]:text-foreground";
  return (
    <footer className="flex flex-wrap justify-center gap-x-5 gap-y-2 p-6 text-xs">
      <Link to="/{-$accountsUserId}/help" className={footerLinkClassName}>
        {messages.help}
      </Link>
      <Link to="/{-$accountsUserId}/licenses" className={footerLinkClassName}>
        {messages.licenses}
      </Link>
      <Link to="/{-$accountsUserId}/privacy" className={footerLinkClassName}>
        {messages.privacy}
      </Link>
      <Link to="/{-$accountsUserId}/terms" className={footerLinkClassName}>
        {messages.terms}
      </Link>
    </footer>
  );
}
