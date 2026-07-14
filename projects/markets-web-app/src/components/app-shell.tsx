import type { ReactNode } from "react";

import { useMarketsLocale } from "../client/i18n/markets-locale";

export const CANONICAL_MARKETS_ROUTES = [
  "/login",
  "/settings/points-connection",
  "/auctions",
  "/auctions/import",
  "/auctions/$auctionId",
  "/me/auctions/created",
  "/me/auctions/bids",
  "/me/auctions/won",
  "/proofs/$proofId",
  "/settlements/$settlementId",
] as const;

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const { locale, setLocale, t } = useMarketsLocale();
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
