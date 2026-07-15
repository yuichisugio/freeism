import { useState } from "react";

const scopeLabels: Record<string, string> = {
  offline_access: "ログインしていない間も連携を維持",
  "points.balance.read": "ポイント残高を確認",
  "points.connection.read": "Points連携状態を確認",
  "points.connection.unlink": "Points連携を明示的に解除",
  "points.reservations.create": "入札時にポイントを予約",
};

export function ConsentPanel({
  clientName = "Freeism Markets",
  oauthQuery = "",
  scopes = [],
}: Readonly<{ clientName?: string; oauthQuery?: string; scopes?: string[] }>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function decide(accept: boolean) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/oauth2/consent", {
        body: JSON.stringify({
          accept,
          oauth_query:
            oauthQuery || (typeof window === "undefined" ? "" : window.location.search.slice(1)),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as { redirect_uri?: string; url?: string };
      if (!response.ok) {
        setError("連携の選択を確定できませんでした。");
        return;
      }
      const redirect = body.redirect_uri ?? body.url;
      if (redirect) window.location.assign(redirect);
    } catch {
      setError("連携の選択を確定できませんでした。");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="form-card">
      <h2>{clientName}との連携</h2>
      <p>次の操作を許可します。追加された権限だけを確認してください。</p>
      <ul>
        {scopes.map((scope) => (
          <li key={scope}>{scopeLabels[scope] ?? scope}</li>
        ))}
      </ul>
      <div className="button-row">
        <button disabled={pending} onClick={() => void decide(true)} type="button">
          許可する
        </button>
        <button
          className="secondary-button"
          disabled={pending}
          onClick={() => void decide(false)}
          type="button"
        >
          許可しない
        </button>
      </div>
      {error ? (
        <p className="status-card status-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
