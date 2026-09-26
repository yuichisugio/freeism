import { Button } from "@heroui/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { authClient } from "../../../lib/auth-client";
import { useI18n, useMessages } from "../../../lib/i18n/i18n-provider";
import type { Language } from "../../../lib/i18n/language";
import { useHydratedSession } from "../../../lib/use-hydrated-session";
import { appShellMessages } from "../messages";

const languageOptions: { value: Language; label: string }[] = [
  { value: "ja", label: "日本語" },
  { value: "en", label: "English" },
];

const navigationLinkClassName = "rounded px-2 py-1 text-sm hover:bg-default data-[status=active]:font-semibold";

/**
 * 全画面共通のヘッダー。
 * ロゴとサービス名、管理画面への移動、表示言語の切替、ログアウトを置く。
 * ロゴはファビコンと同じSVGを使う。
 */
export function AppHeader() {
  const messages = useMessages(appShellMessages);
  const { language, setLanguage } = useI18n();
  // 事前生成したトップページと描画を揃えるため、hydrationの後にログアウトを表示する。
  const session = useHydratedSession();
  const navigate = useNavigate();
  const [hasSignOutFailed, setHasSignOutFailed] = useState(false);

  /**
   * ログイン画面へ移動してからログアウトする。
   * 先に移動することで、未保存の変更がある場合は移動の確認を経てからログアウトする。
   */
  const signOut = async () => {
    setHasSignOutFailed(false);
    await navigate({ to: "/" });
    // 未保存の確認で「編集に戻る」を選んだ場合は移動していないため、ログアウトしない。
    if (window.location.pathname !== "/") return;
    try {
      const result = await authClient.signOut();
      if (result.error) setHasSignOutFailed(true);
    } catch {
      setHasSignOutFailed(true);
    }
  };

  return (
    <header className="border-b border-default">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <img src="/favicon.svg" alt="" width={24} height={24} />
          {messages.appName}
        </Link>
        <nav aria-label={messages.mainNavigation} className="flex flex-wrap gap-1">
          <Link to="/account-links" className={navigationLinkClassName}>
            {messages.accountLinks}
          </Link>
          <Link to="/settings" className={navigationLinkClassName}>
            {messages.settings}
          </Link>
          <Link to="/developer" className={navigationLinkClassName}>
            {messages.developer}
          </Link>
          <Link to="/help" className={navigationLinkClassName}>
            {messages.help}
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div role="group" aria-label={messages.language} className="flex gap-1">
            {languageOptions.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={language === option.value ? "secondary" : "ghost"}
                aria-pressed={language === option.value}
                onPress={() => setLanguage(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          {session.data ? (
            <Button size="sm" variant="outline" onPress={() => void signOut()}>
              {messages.signOut}
            </Button>
          ) : null}
          {hasSignOutFailed ? (
            <span role="alert" className="text-sm text-danger">
              {messages.signOutFailed}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/**
 * 全画面共通のフッター。
 * ヘルプ・OSSライセンス・プライバシーポリシー・利用規約へのリンクを置く。
 */
export function AppFooter() {
  const messages = useMessages(appShellMessages);
  return (
    <footer className="mx-auto flex max-w-6xl flex-wrap gap-4 px-4 py-6 text-sm text-muted">
      <Link to="/help" className="underline">
        {messages.help}
      </Link>
      <Link to="/licenses" className="underline">
        {messages.licenses}
      </Link>
      <Link to="/privacy" className="underline">
        {messages.privacy}
      </Link>
      <Link to="/terms" className="underline">
        {messages.terms}
      </Link>
    </footer>
  );
}
