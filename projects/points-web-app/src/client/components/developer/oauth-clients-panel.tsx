import { useEffect, useState } from "react";

import {
  oauthClientLimitPerUser,
  type OAuthClientDetail,
} from "../../../shared/schemas/oauth-client-schema";
import {
  emptyOAuthClientForm,
  parseOAuthClientForm,
  toOAuthClientForm,
  type OAuthClientForm,
} from "./oauth-client-form";

const clientsPath = "/api/oauth-clients";

type Selection = { kind: "new" } | { kind: "existing"; clientId: string } | null;

function clientPath(clientId: string): string {
  return `${clientsPath}/${encodeURIComponent(clientId)}`;
}

/** Points の BFF が返す `{data}` を読む。 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { code?: string } | null;
    if (response.status === 401) throw new Error("ログインしてから操作してください。");
    if (problem?.code === "CLIENT_LIMIT_REACHED")
      throw new Error("登録できるアプリは 5 件までです。");
    if (problem?.code === "INVALID_JWKS") throw new Error("公開鍵を確認してください。");
    if (problem?.code === "CLIENT_KEY_SAVE_FAILED") {
      throw new Error("公開鍵を保存できませんでした。同じ内容で再度保存してください。");
    }
    throw new Error("操作に失敗しました。入力内容を確認して再度お試しください。");
  }
  const body = (await response.json()) as { data: T };
  return body.data;
}

/** ログイン本人が所有する OAuth クライアントを管理する。 */
export function OAuthClientsPanel() {
  const [clients, setClients] = useState<OAuthClientDetail[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [form, setForm] = useState<OAuthClientForm>(emptyOAuthClientForm);
  const [savedForm, setSavedForm] = useState<OAuthClientForm>(emptyOAuthClientForm);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void request<{ clients: OAuthClientDetail[] }>(clientsPath).then(
      (data) => {
        if (!active) return;
        setClients(data.clients);
        const first = data.clients[0];
        if (first) {
          const loadedForm = toOAuthClientForm(first);
          setSelection({ kind: "existing", clientId: first.clientId });
          setForm(loadedForm);
          setSavedForm(loadedForm);
        }
        setLoading(false);
      },
      (cause: unknown) => {
        if (!active) return;
        setLoadError(cause instanceof Error ? cause.message : "一覧を読み込めませんでした。");
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  const validation = parseOAuthClientForm(form);
  const canCreate = clients.length < oauthClientLimitPerUser;
  const selectedClient =
    selection?.kind === "existing"
      ? clients.find((client) => client.clientId === selection.clientId)
      : undefined;

  function select(next: Selection, client?: OAuthClientDetail) {
    if (isDirty && !window.confirm("未保存の変更を破棄しますか？")) return;
    const nextForm = client ? toOAuthClientForm(client) : emptyOAuthClientForm;
    setSelection(next);
    setForm(nextForm);
    setSavedForm(nextForm);
    setMessage(null);
    setError(null);
    setConfirmDelete(false);
  }

  function changeField(field: "name" | "uri" | "description" | "jwksText", value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage(null);
    setError(null);
  }

  async function save() {
    if (!isDirty || selection === null || validation.input === null || saving) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const isNew = selection.kind === "new";
      const path = isNew ? clientsPath : clientPath(selection.clientId);
      const client = await request<OAuthClientDetail>(path, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.input),
      });
      setClients((current) =>
        isNew
          ? [...current, client]
          : current.map((item) => (item.clientId === client.clientId ? client : item)),
      );
      setSelection({ kind: "existing", clientId: client.clientId });
      const saved = toOAuthClientForm(client);
      setForm(saved);
      setSavedForm(saved);
      setMessage(isNew ? "アプリを登録しました。" : "変更を保存しました。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (selection?.kind !== "existing" || deleting) return;
    const { clientId } = selection;
    setDeleting(true);
    setError(null);
    try {
      await request<{ ok: true }>(clientPath(clientId), { method: "DELETE" });
      setClients((current) => current.filter((client) => client.clientId !== clientId));
      setSelection(null);
      setForm(emptyOAuthClientForm);
      setSavedForm(emptyOAuthClientForm);
      setMessage("アプリを削除しました。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "削除できませんでした。");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (loading) return <p className="status-card">読み込み中…</p>;
  if (loadError) {
    return (
      <div role="alert" className="status-card status-error">
        <p>{loadError}</p>
        {loadError === "ログインしてから操作してください。" ? (
          <a href="/login">ログイン画面へ</a>
        ) : null}
      </div>
    );
  }

  return (
    <section className="card-grid" aria-label="OAuth クライアント管理">
      <div className="form-card">
        <h2>登録したアプリ</h2>
        {clients.length === 0 ? <p>登録したアプリはありません。</p> : null}
        {clients.map((client) => (
          <button
            aria-pressed={selection?.kind === "existing" && selection.clientId === client.clientId}
            key={client.clientId}
            onClick={() => select({ kind: "existing", clientId: client.clientId }, client)}
            type="button"
          >
            {client.name}
          </button>
        ))}
        <button disabled={!canCreate} onClick={() => select({ kind: "new" })} type="button">
          新規登録
        </button>
        {!canCreate ? (
          <p>
            登録できるアプリは {oauthClientLimitPerUser}{" "}
            件までです。新しく登録するには不要なアプリを削除してください。
          </p>
        ) : null}
      </div>

      {selection === null ? (
        <p className="status-card">アプリを選択するか、新規登録してください。</p>
      ) : (
        <form
          className="form-card"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <h2>{selection.kind === "new" ? "アプリの新規登録" : selectedClient?.name}</h2>
          <fieldset>
            <legend>アプリ情報</legend>
            <label>
              アプリ名
              <input
                name="name"
                onChange={(event) => changeField("name", event.target.value)}
                required
                value={form.name}
              />
              {isDirty && validation.errors.name ? (
                <span role="alert">{validation.errors.name}</span>
              ) : null}
            </label>
            <label>
              紹介 URL（任意、HTTPS）
              <input
                inputMode="url"
                name="uri"
                onChange={(event) => changeField("uri", event.target.value)}
                value={form.uri}
              />
              {isDirty && validation.errors.uri ? (
                <span role="alert">{validation.errors.uri}</span>
              ) : null}
            </label>
            <label>
              説明文（任意）
              <textarea
                name="description"
                onChange={(event) => changeField("description", event.target.value)}
                rows={3}
                value={form.description}
              />
            </label>
          </fieldset>
          <fieldset>
            <legend>接続情報</legend>
            <p>
              リダイレクト URL を 1 件以上登録してください。ローカル開発では HTTP の
              localhost、127.0.0.1、[::1] を登録できます。
            </p>
            {form.redirectUris.map((uri, index) => (
              <div className="ordered-row" key={index}>
                <label>
                  リダイレクト URL {index + 1}
                  <input
                    aria-label={`リダイレクト URL ${index + 1}`}
                    inputMode="url"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        redirectUris: current.redirectUris.map((item, position) =>
                          position === index ? event.target.value : item,
                        ),
                      }))
                    }
                    required
                    value={uri}
                  />
                  {isDirty && validation.errors.redirectUris[index] ? (
                    <span role="alert">{validation.errors.redirectUris[index]}</span>
                  ) : null}
                </label>
                <button
                  aria-label={`リダイレクト URL ${index + 1} を削除`}
                  disabled={form.redirectUris.length === 1}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      redirectUris: current.redirectUris.filter(
                        (_, position) => position !== index,
                      ),
                    }))
                  }
                  type="button"
                >
                  削除
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setForm((current) => ({ ...current, redirectUris: [...current.redirectUris, ""] }))
              }
              type="button"
            >
              リダイレクト URL を追加
            </button>
            <p>ローカル開発用 URL を含むアプリは native、それ以外は web として登録されます。</p>
            {selectedClient ? (
              <div>
                <strong>Client ID</strong>
                <p className="data-line">{selectedClient.clientId}</p>
              </div>
            ) : (
              <p>Client ID は登録後に発行されます。</p>
            )}
            <label>
              private_key_jwt 用の公開鍵（JWKS）
              <textarea
                name="jwks"
                onChange={(event) => changeField("jwksText", event.target.value)}
                required
                rows={8}
                spellCheck={false}
                value={form.jwksText}
              />
              {isDirty && validation.errors.jwks ? (
                <span role="alert">{validation.errors.jwks}</span>
              ) : null}
            </label>
            <p>
              公開鍵を {'{"keys":[...]}'}{" "}
              形式で入力してください。対応する秘密鍵は利用側アプリのバックエンドで保管します。鍵の切替時は新旧の鍵を併記して保存し、その後で旧鍵を外してください。
            </p>
          </fieldset>
          <div className="button-row">
            <button disabled={!isDirty || validation.input === null || saving} type="submit">
              {saving ? "保存中…" : "保存"}
            </button>
            {selection.kind === "existing" ? (
              <button onClick={() => setConfirmDelete(true)} type="button">
                アプリを削除
              </button>
            ) : null}
          </div>
          {confirmDelete ? (
            <div role="alertdialog" aria-label="アプリの削除">
              <p>このアプリを削除しますか？</p>
              <button disabled={deleting} onClick={() => void remove()} type="button">
                {deleting ? "削除中…" : "削除する"}
              </button>
              <button disabled={deleting} onClick={() => setConfirmDelete(false)} type="button">
                キャンセル
              </button>
            </div>
          ) : null}
        </form>
      )}
      {message ? (
        <p aria-live="polite" className="status-card">
          {message}
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="status-card status-error">
          <p>{error}</p>
          {error === "ログインしてから操作してください。" ? (
            <a href="/login">ログイン画面へ</a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
