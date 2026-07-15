import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { marketsClient, type MarketsClient } from "../client/api/markets-client";
import { useMarketsLocale } from "../client/i18n/markets-locale";
import { ProblemBanner } from "../components/problem-banner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "ログイン | Freeism Markets" }] }),
});

export function LoginPage({ client = marketsClient }: Readonly<{ client?: MarketsClient }>) {
  const { t } = useMarketsLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="page-shell">
      <section aria-labelledby="login-heading" className="ledger-panel">
        <p className="eyebrow">Authentication</p>
        <h1 id="login-heading">{t("login")}</h1>
        <p>MarketsのアカウントへGoogle OAuthでログインします。</p>
        {error ? <ProblemBanner message={error} /> : null}
        <button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            void client.startGoogleLogin().then(
              ({ url }) => window.location.assign(url),
              (reason: unknown) => {
                setError(reason instanceof Error ? reason.message : "LOGIN_FAILED");
                setBusy(false);
              },
            );
          }}
          type="button"
        >
          {t("loginWithGoogle")}
        </button>
      </section>
    </main>
  );
}
