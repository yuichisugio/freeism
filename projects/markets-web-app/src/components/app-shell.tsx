import { useEffect, useState, type ReactNode } from "react";

import { marketsClient, type MarketsClient } from "../client/api/markets-client";
import { useMarketsLocale } from "../client/i18n/markets-locale";

export const CANONICAL_MARKETS_ROUTES = [
  "/login",
  "/settings/points-connection",
  "/admin/points-connections",
  "/auctions",
  "/auctions/import",
  "/auctions/$auctionId",
  "/me/auctions/created",
  "/me/auctions/bids",
  "/me/auctions/won",
  "/proofs/$proofId",
  "/settlements/$settlementId",
] as const;

export function AppShell({
  children,
  client = marketsClient,
}: Readonly<{ children: ReactNode; client?: MarketsClient }>) {
  const { locale, setLocale, t } = useMarketsLocale();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    void client.session().then(
      (session) => {
        if (active)
          setIsAdmin(
            Boolean(
              session?.user?.role
                ?.split(",")
                .map((role) => role.trim())
                .includes("admin"),
            ),
          );
      },
      () => {
        if (active) setIsAdmin(false);
      },
    );
    return () => {
      active = false;
    };
  }, [client]);
  return (
    <>
      <header className="app-header">
        <a className="brand-link" href="/auctions">
          {t("serviceName")}
        </a>
        <nav aria-label={locale === "ja" ? "主要メニュー" : "Main navigation"}>
          <a href="/auctions">{t("auctions")}</a>
          <a href="/auctions/import">{t("importAuctions")}</a>
          <a href="/me/auctions/created">{t("created")}</a>
          <a href="/me/auctions/bids">{t("bids")}</a>
          <a href="/me/auctions/won">{t("won")}</a>
          <a href="/settings/points-connection">{t("pointsConnection")}</a>
          {isAdmin ? <a href="/admin/points-connections">接続先の管理</a> : null}
        </nav>
        <div className="locale-switch" aria-label={t("language")} role="group">
          <button aria-pressed={locale === "ja"} onClick={() => setLocale("ja")} type="button">
            日本語
          </button>
          <button aria-pressed={locale === "en"} onClick={() => setLocale("en")} type="button">
            English
          </button>
        </div>
      </header>
      {children}
      <footer className="app-footer">
        <a href="/terms">{t("terms")}</a>
        <a href="/privacy">{t("privacy")}</a>
        <a href="/docs">{t("docs")}</a>
      </footer>
    </>
  );
}
