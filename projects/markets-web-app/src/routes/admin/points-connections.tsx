import { useCallback, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";

import {
  createIdempotencyKey,
  MarketsApiError,
  marketsClient,
  type AdminPointsProvider,
  type MarketsClient,
} from "../../client/api/markets-client";
import { useApiResource } from "../../client/api/use-api-resource";
import { ProblemBanner } from "../../components/problem-banner";

export const Route = createFileRoute("/admin/points-connections")({
  component: PointsConnectionsAdminPage,
  head: () => ({ meta: [{ title: "接続先の管理 | Freeism Markets" }] }),
});

export function PointsConnectionsAdminPage({
  client = marketsClient,
}: Readonly<{ client?: MarketsClient }>) {
  const load = useCallback(() => client.adminPointsProviders(), [client]);
  const resource = useApiResource(load, { clearOnError: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [reason, setReason] = useState("");

  async function run(operation: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await operation();
      resource.reload();
    } catch (cause) {
      setError(
        cause instanceof MarketsApiError
          ? cause.problem.code
          : cause instanceof Error
            ? cause.message
            : "REQUEST_FAILED",
      );
    } finally {
      setBusy(false);
    }
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(() =>
      client.createPointsProvider(origin.trim(), displayName.trim(), reason.trim(), {
        idempotencyKey: createIdempotencyKey("provider_create"),
      }),
    );
  }

  return (
    <main className="page-shell">
      <section aria-labelledby="admin-providers-heading" className="ledger-panel">
        <p className="eyebrow">ADMIN</p>
        <h1 id="admin-providers-heading">ポイントサービスの接続先</h1>
        <p>提供先を登録し、発行された Client ID を設定して有効化します。</p>
        {resource.loading ? <p aria-live="polite">読み込み中…</p> : null}
        {resource.error ? (
          <ProblemBanner message="接続先を取得できません。管理者としてログインしてください。" />
        ) : null}
        {error === "FRESH_GOOGLE_AUTH_REQUIRED" ? (
          <div>
            <ProblemBanner message="管理操作には再ログインが必要です。戻ってから操作を続けてください。" />
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const { url } = await client.startGoogleLogin("/admin/points-connections");
                  window.location.assign(url);
                })
              }
              type="button"
            >
              Googleで再ログイン
            </button>
          </div>
        ) : error ? (
          <ProblemBanner message={error} />
        ) : null}
        {resource.data ? (
          <>
            <form onSubmit={create}>
              <h2>提供先を登録</h2>
              <label htmlFor="provider-name">表示名</label>
              <input
                id="provider-name"
                maxLength={100}
                onChange={(event) => setDisplayName(event.currentTarget.value)}
                required
                value={displayName}
              />
              <label htmlFor="provider-origin">提供先のURL</label>
              <input
                id="provider-origin"
                onChange={(event) => setOrigin(event.currentTarget.value)}
                placeholder="https://points.example.com"
                required
                type="url"
                value={origin}
              />
              <label htmlFor="provider-create-reason">登録理由</label>
              <textarea
                id="provider-create-reason"
                onChange={(event) => setReason(event.currentTarget.value)}
                required
                value={reason}
              />
              <button disabled={busy} type="submit">
                登録する
              </button>
            </form>
            {resource.data.length === 0 ? <p>登録済みの提供先はありません。</p> : null}
            {resource.data.map((provider) => (
              <ProviderAdminCard
                busy={busy}
                client={client}
                key={provider.providerId}
                provider={provider}
                run={run}
              />
            ))}
          </>
        ) : null}
      </section>
    </main>
  );
}

function ProviderAdminCard({
  busy,
  client,
  provider,
  run,
}: Readonly<{
  busy: boolean;
  client: MarketsClient;
  provider: AdminPointsProvider;
  run: (operation: () => Promise<unknown>) => Promise<void>;
}>) {
  const [clientId, setClientId] = useState("");
  const [reason, setReason] = useState("");
  return (
    <section aria-labelledby={`provider-${provider.providerId}`} className="sub-panel">
      <h2 id={`provider-${provider.providerId}`}>{provider.displayName}</h2>
      <p>{provider.origin}</p>
      <p className="status-label">
        {provider.status === "ACTIVE"
          ? "利用可能"
          : provider.status === "STOPPED"
            ? "停止中"
            : "登録待ち"}
      </p>
      <dl className="fact-list">
        <div>
          <dt>提供先の発行者URL</dt>
          <dd>
            <code>{provider.issuer}</code>
          </dd>
        </div>
        <div>
          <dt>ポイントAPIのURL</dt>
          <dd>
            <code>{provider.resource}</code>
          </dd>
        </div>
        <div>
          <dt>連携用コールバックURL</dt>
          <dd>
            <code>{provider.callbackUrls.link}</code>
          </dd>
        </div>
        <div>
          <dt>解除用コールバックURL</dt>
          <dd>
            <code>{provider.callbackUrls.unlink}</code>
          </dd>
        </div>
        <div>
          <dt>Client ID</dt>
          <dd>{provider.clientId ?? "未登録"}</dd>
        </div>
        <div>
          <dt>公開 JWK Set</dt>
          <dd>
            <pre>{JSON.stringify(provider.publicJwks, null, 2)}</pre>
          </dd>
        </div>
      </dl>
      {provider.status !== "ACTIVE" && provider.status !== "STOPPED" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(() =>
              client.activatePointsProvider(provider.providerId, clientId.trim(), reason.trim(), {
                idempotencyKey: createIdempotencyKey("provider_activate"),
              }),
            );
          }}
        >
          <p>
            公開 JWK Set と2つのコールバックURLを提供先の開発者画面に登録し、発行された Client ID
            を入力してください。
          </p>
          <label htmlFor={`client-id-${provider.providerId}`}>Client ID</label>
          <input
            id={`client-id-${provider.providerId}`}
            onChange={(event) => setClientId(event.currentTarget.value)}
            required
            value={clientId}
          />
          <label htmlFor={`activate-reason-${provider.providerId}`}>有効化理由</label>
          <textarea
            id={`activate-reason-${provider.providerId}`}
            onChange={(event) => setReason(event.currentTarget.value)}
            required
            value={reason}
          />
          <button disabled={busy} type="submit">
            有効化する
          </button>
        </form>
      ) : null}
      {provider.status === "ACTIVE" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(() =>
              client.stopPointsProvider(provider.providerId, reason.trim(), {
                idempotencyKey: createIdempotencyKey("provider_stop"),
              }),
            );
          }}
        >
          <p>停止後は新規連携・出品・入札ができなくなります。既存取引の精算は続きます。</p>
          <label htmlFor={`stop-reason-${provider.providerId}`}>停止理由</label>
          <textarea
            id={`stop-reason-${provider.providerId}`}
            onChange={(event) => setReason(event.currentTarget.value)}
            required
            value={reason}
          />
          <button disabled={busy} type="submit">
            停止する
          </button>
        </form>
      ) : null}
    </section>
  );
}
