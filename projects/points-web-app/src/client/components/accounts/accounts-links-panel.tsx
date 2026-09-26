import { useCallback, useEffect, useState } from "react";

import { ProblemState } from "../operation-page";
import {
  AccountsExternalAccountList,
  type AccountsExternalAccount,
} from "./accounts-external-account-list";

/**
 * 設定画面の「Accounts連携」区画。
 * 接続先を選んで連携を始め、連携ごとの状態・外部アカウント・Accountsへのリンク・解除を示す。
 * @see ../../../backend/http/routes/accounts-link-routes.ts
 * @see ./accounts-links-panel.test.tsx
 */

// --------------------------------------------------
// 型
// --------------------------------------------------

export type AccountsConnectionOption = {
  id: string;
  displayName: string;
  accountsOrigin: string;
};

export type AccountsLinkView = {
  id: string;
  accountsConnection: AccountsConnectionOption & {
    status: "PENDING_CLIENT_REGISTRATION" | "ACTIVE" | "WITHDRAWN";
  };
  accountsUserId: string;
  accountsProfileUrl: string;
  accountsManagementUrl: string;
  provisionStatus: "PROVIDED" | "NOT_PROVIDED" | null;
  fetchedAt: string | null;
  externalAccounts: AccountsExternalAccount[] | null;
};

// --------------------------------------------------
// 表示
// --------------------------------------------------

const provisionStatusLabels = {
  PROVIDED: "提供中",
  NOT_PROVIDED: "情報提供が停止しています",
  UNFETCHED: "未取得",
} as const;

/**
 * 戻り先のerror codeごとの案内。
 */
const linkErrorMessages: Record<string, string> = {
  ACCOUNTS_AUTHORIZATION_DENIED: "Accountsで連携が許可されませんでした。",
  ACCOUNTS_LINK_ATTEMPT_INVALID:
    "連携の手続きが無効か、期限が切れています。もう一度「Accountsと連携する」から始めてください。",
  ACCOUNTS_ID_TOKEN_INVALID: "Accountsからの応答を確認できませんでした。もう一度お試しください。",
  ACCOUNTS_USER_LINKED_TO_OTHER_POINTS_USER:
    "このAccountsアカウントは、別のPointsアカウントに連携済みです。そのPointsアカウントで解除してから、もう一度お試しください。",
  ACCOUNTS_CONNECTION_NOT_ACTIVE: "この接続先は現在利用できません。",
  ACCOUNTS_UNAVAILABLE: "Accountsに接続できませんでした。時間をおいて、もう一度お試しください。",
};

export function AccountsLinkResultMessage({
  result,
  error,
}: Readonly<{ result: string | null; error: string | null }>) {
  if (error !== null) {
    return (
      <ProblemState message={linkErrorMessages[error] ?? "Accountsと連携できませんでした。"} />
    );
  }
  if (result === "LINKED") return <p className="status-card">Accountsと連携しました。</p>;
  return null;
}

export function AccountsLinkStartForm({
  connections,
  onStart,
  pending,
}: Readonly<{
  connections: AccountsConnectionOption[];
  onStart: (accountsConnectionId: string) => void;
  pending: boolean;
}>) {
  const [selectedId, setSelectedId] = useState("");
  if (connections.length === 0) return <p>連携できるAccountsはまだありません。</p>;
  const connectionId = selectedId || connections[0]!.id;
  return (
    <div className="button-row">
      <label>
        接続先
        <select onChange={(event) => setSelectedId(event.target.value)} value={connectionId}>
          {connections.map((connection) => (
            <option key={connection.id} value={connection.id}>
              {`${connection.displayName}（${connection.accountsOrigin}）`}
            </option>
          ))}
        </select>
      </label>
      <button disabled={pending} onClick={() => onStart(connectionId)} type="button">
        Accountsと連携する
      </button>
    </div>
  );
}

export function AccountsLinkList({
  links,
  onDelete,
  onRelink,
  pending,
}: Readonly<{
  links: AccountsLinkView[];
  onDelete: (link: AccountsLinkView) => void;
  onRelink: (link: AccountsLinkView) => void;
  pending: boolean;
}>) {
  if (links.length === 0) return <p>Accountsとの連携はありません。</p>;
  return (
    <ul className="signed-list">
      {links.map((link) => (
        <li key={link.id}>
          <strong>{provisionStatusLabels[link.provisionStatus ?? "UNFETCHED"]}</strong>
          <span>
            {`${link.accountsConnection.displayName}（${link.accountsConnection.accountsOrigin}）`}
          </span>
          <small>{`Accounts ID: ${link.accountsUserId}`}</small>
          {link.provisionStatus === "PROVIDED" && link.externalAccounts !== null ? (
            <AccountsExternalAccountList externalAccounts={link.externalAccounts} />
          ) : null}
          <span className="button-row">
            <a href={link.accountsManagementUrl} rel="noopener noreferrer">
              Accountsで公開範囲を管理
            </a>
            <a href={link.accountsProfileUrl} rel="noopener noreferrer">
              Accountsのプロフィール
            </a>
            {link.accountsConnection.status === "ACTIVE" ? (
              <button
                className="secondary-button"
                disabled={pending}
                onClick={() => onRelink(link)}
                type="button"
              >
                再連携
              </button>
            ) : null}
            <button
              className="secondary-button"
              disabled={pending}
              onClick={() => onDelete(link)}
              type="button"
            >
              解除
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

// --------------------------------------------------
// 区画
// --------------------------------------------------

/**
 * 連携の一覧・開始・解除を行う区画。
 * 開始はAccountsの認可URLへ移動し、戻り先の結果は設定画面のqueryで受け取る。
 */
export function AccountsLinksPanel() {
  const [links, setLinks] = useState<AccountsLinkView[] | null>(null);
  const [connections, setConnections] = useState<AccountsConnectionOption[]>([]);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [callbackResult, setCallbackResult] = useState<{
    result: string | null;
    error: string | null;
  }>({ result: null, error: null });

  const load = useCallback(async () => {
    const [linksResponse, connectionsResponse] = await Promise.all([
      fetch("/api/accounts-links"),
      fetch("/api/accounts-connections"),
    ]);
    if (!linksResponse.ok || !connectionsResponse.ok) {
      setFailed(true);
      return;
    }
    setLinks(((await linksResponse.json()) as { data: AccountsLinkView[] }).data);
    setConnections(
      ((await connectionsResponse.json()) as { data: AccountsConnectionOption[] }).data,
    );
    setFailed(false);
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setCallbackResult({
      result: query.get("accountsLinkResult"),
      error: query.get("accountsLinkError"),
    });
    void load();
  }, [load]);

  async function start(accountsConnectionId: string) {
    setPending(true);
    const response = await fetch("/api/accounts-links/attempts", {
      body: JSON.stringify({ accountsConnectionId }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (response.ok) {
      const { data } = (await response.json()) as { data: { authorizationUrl: string } };
      window.location.assign(data.authorizationUrl);
      return;
    }
    setPending(false);
    setMessage(
      response.status === 429
        ? "連携の開始が多すぎます。時間をおいて、もう一度お試しください。"
        : "連携を開始できませんでした。",
    );
  }

  async function remove(link: AccountsLinkView) {
    const confirmed = window.confirm(
      `${link.accountsConnection.displayName}との連携を解除します。Pointsのプロフィールに外部アカウントが表示されなくなります。`,
    );
    if (!confirmed) return;
    setPending(true);
    const response = await fetch(`/api/accounts-links/${encodeURIComponent(link.id)}`, {
      method: "DELETE",
    });
    setPending(false);
    setMessage(response.ok ? "連携を解除しました。" : "連携を解除できませんでした。");
    await load();
  }

  return (
    <section className="form-card">
      <h2>Freeism Accounts</h2>
      <p>
        Accountsで公開している外部アカウントを、Pointsのプロフィールに表示します。公開範囲はAccountsで管理します。
      </p>
      <AccountsLinkResultMessage error={callbackResult.error} result={callbackResult.result} />
      {message ? <p className="status-card">{message}</p> : null}
      {failed ? <ProblemState message="Accounts連携を読み込めませんでした。" /> : null}
      <AccountsLinkStartForm
        connections={connections}
        onStart={(connectionId) => void start(connectionId)}
        pending={pending}
      />
      {links === null ? null : (
        <AccountsLinkList
          links={links}
          onDelete={(link) => void remove(link)}
          onRelink={(link) => void start(link.accountsConnection.id)}
          pending={pending}
        />
      )}
    </section>
  );
}
