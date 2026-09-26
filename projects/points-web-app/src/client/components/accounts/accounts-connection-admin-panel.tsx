import { useCallback, useEffect, useState } from "react";

import { GoogleReauthButton } from "../auth/google-reauth-button";
import { ProblemState } from "../operation-page";

/**
 * 運営者の「接続先Accounts」画面。
 * 接続先の作成、Accountsへ登録する情報の表示、Client IDによる有効化、取り下げを行う。
 * @see ../../../backend/http/routes/accounts-connection-routes.ts
 * @see ./accounts-connection-admin-panel.test.tsx
 */

// --------------------------------------------------
// 型
// --------------------------------------------------

export type AccountsConnectionView = {
  id: string;
  displayName: string;
  accountsOrigin: string;
  status: "PENDING_CLIENT_REGISTRATION" | "ACTIVE" | "WITHDRAWN";
  clientId: string | null;
  registration: {
    applicationName: string;
    applicationUrl: string;
    redirectUri: string;
    jwks: { keys: Record<string, string>[] };
  } | null;
};

// --------------------------------------------------
// 表示
// --------------------------------------------------

const statusLabels = {
  PENDING_CLIENT_REGISTRATION: "Client ID登録待ち",
  ACTIVE: "有効",
  WITHDRAWN: "取り下げ済み",
} as const;

function RegistrationDetails({
  registration,
}: Readonly<{ registration: NonNullable<AccountsConnectionView["registration"]> }>) {
  const jwks = JSON.stringify(registration.jwks, null, 2);
  return (
    <details>
      <summary>Accountsの開発者向け画面へ登録する情報</summary>
      <dl>
        <dt>アプリ名（推奨）</dt>
        <dd>{registration.applicationName}</dd>
        <dt>紹介URL（推奨）</dt>
        <dd>{registration.applicationUrl}</dd>
        <dt>リダイレクトURL</dt>
        <dd>
          <code>{registration.redirectUri}</code>
        </dd>
        <dt>JWK Set</dt>
        <dd>
          <pre>{jwks}</pre>
          <button
            className="secondary-button"
            onClick={() => void navigator.clipboard.writeText(jwks)}
            type="button"
          >
            JWK Setをコピー
          </button>
        </dd>
      </dl>
    </details>
  );
}

function ActivationForm({
  canSubmit,
  onActivate,
}: Readonly<{ canSubmit: boolean; onActivate: (clientId: string) => void }>) {
  const [clientId, setClientId] = useState("");
  return (
    <span className="button-row">
      <label>
        Client ID
        <input onChange={(event) => setClientId(event.target.value)} value={clientId} />
      </label>
      <button
        disabled={!canSubmit || clientId.trim().length === 0}
        onClick={() => onActivate(clientId.trim())}
        type="button"
      >
        Client IDを登録して有効化
      </button>
    </span>
  );
}

export function AccountsConnectionList({
  connections,
  canSubmit,
  onActivate,
  onWithdraw,
}: Readonly<{
  connections: AccountsConnectionView[];
  canSubmit: boolean;
  onActivate: (connection: AccountsConnectionView, clientId: string) => void;
  onWithdraw: (connection: AccountsConnectionView) => void;
}>) {
  if (connections.length === 0) return <p>接続先はまだありません。</p>;
  return (
    <ul className="signed-list">
      {connections.map((connection) => (
        <li key={connection.id}>
          <strong>{statusLabels[connection.status]}</strong>
          <span>{`${connection.displayName}（${connection.accountsOrigin}）`}</span>
          <small>
            {connection.clientId === null ? connection.id : `Client ID: ${connection.clientId}`}
          </small>
          {connection.registration === null ? null : (
            <RegistrationDetails registration={connection.registration} />
          )}
          {connection.status === "PENDING_CLIENT_REGISTRATION" ? (
            <ActivationForm
              canSubmit={canSubmit}
              onActivate={(clientId) => onActivate(connection, clientId)}
            />
          ) : null}
          {connection.status === "WITHDRAWN" ? null : (
            <button
              className="secondary-button"
              disabled={!canSubmit}
              onClick={() => onWithdraw(connection)}
              type="button"
            >
              取り下げ
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

// --------------------------------------------------
// 画面
// --------------------------------------------------

/**
 * 変更の要求を送る。
 * 再送で二重に処理しないよう、操作ごとにIdempotency-Keyを作る。
 */
function postAdminOperation(path: string, body: unknown) {
  return fetch(path, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    method: "POST",
  });
}

async function toFailureMessage(response: Response, action: string): Promise<string> {
  if (response.status === 401) {
    return `Googleで再認証してから、もう一度${action}してください。`;
  }
  const body = (await response.json().catch(() => null)) as { code?: string } | null;
  return `${action}できませんでした（${body?.code ?? response.status}）。`;
}

export function AccountsConnectionAdminPanel() {
  const [connections, setConnections] = useState<AccountsConnectionView[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [accountsOrigin, setAccountsOrigin] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/accounts-connections");
    if (!response.ok) {
      setLoadFailed(true);
      return;
    }
    setConnections(((await response.json()) as { data: AccountsConnectionView[] }).data);
    setLoadFailed(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: string, path: string, body: Record<string, string>) {
    const response = await postAdminOperation(path, { ...body, reason });
    setMessage(response.ok ? `${action}しました。` : await toFailureMessage(response, action));
    await load();
    return response.ok;
  }

  async function create() {
    const isCreated = await run("接続先を作成", "/api/admin/accounts-connections", {
      accountsOrigin,
      displayName,
    });
    if (isCreated) {
      setAccountsOrigin("");
      setDisplayName("");
    }
  }

  function withdraw(connection: AccountsConnectionView) {
    const confirmed = window.confirm(
      `${connection.displayName}を取り下げます。この接続先への全ユーザーの連携が解除され、元に戻せません。`,
    );
    if (!confirmed) return;
    void run(
      "取り下げ",
      `/api/admin/accounts-connections/${encodeURIComponent(connection.id)}/withdrawal`,
      {},
    );
  }

  const canSubmit = reason.trim().length > 0;
  return (
    <>
      <section className="form-card">
        <h2>操作の理由</h2>
        <label>
          理由（作成・有効化・取り下げに必要です）
          <textarea onChange={(event) => setReason(event.target.value)} value={reason} />
        </label>
        <GoogleReauthButton />
        {message ? <p className="status-card">{message}</p> : null}
      </section>
      <section className="form-card">
        <h2>接続先を作成</h2>
        <label>
          表示名
          <input onChange={(event) => setDisplayName(event.target.value)} value={displayName} />
        </label>
        <label>
          Accountsのorigin
          <input
            onChange={(event) => setAccountsOrigin(event.target.value)}
            placeholder="https://accounts.freeism.app"
            value={accountsOrigin}
          />
        </label>
        <button
          disabled={!canSubmit || !displayName.trim() || !accountsOrigin.trim()}
          onClick={() => void create()}
          type="button"
        >
          接続先を作成
        </button>
      </section>
      <section className="form-card">
        <h2>接続先</h2>
        {loadFailed ? (
          <ProblemState message="接続先を読み込めませんでした。" />
        ) : (
          <AccountsConnectionList
            canSubmit={canSubmit}
            connections={connections}
            onActivate={(connection, clientId) =>
              void run(
                "有効化",
                `/api/admin/accounts-connections/${encodeURIComponent(connection.id)}/activation`,
                { clientId },
              )
            }
            onWithdraw={withdraw}
          />
        )}
      </section>
    </>
  );
}
