import { useEffect, useState } from "react";

import { oauthClientLimitPerUser } from "../../../../shared/constants";
import { oauthClientDetailSchema, oauthClientListSchema } from "../../../../shared/schemas/oauth-client-schema";
import type { OAuthClientDetail } from "../../../../shared/schemas/oauth-client-schema";
import { okSchema } from "../../../../shared/schemas/problem-details-schema";
import { requestBff } from "../../../lib/api-client";
import {
  emptyOAuthClientForm,
  isSameOAuthClientForm,
  parseOAuthClientForm,
  toOAuthClientForm,
} from "../oauth-client-form";
import type { OAuthClientFieldErrors, OAuthClientForm, OAuthClientTextField } from "../oauth-client-form";

/**
 * 「開発者向け」画面のOAuthクライアント一覧・編集・削除の状態と操作。
 * 未保存の変更がある状態の編集対象の切替は保留し、確認の結果で切り替える。
 * 別画面への移動の確認はrouteで`useUnsavedChangesGuard`を使う。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./use-oauth-clients.test.tsx
 */

// --------------------------------------------------
// 型
// --------------------------------------------------

/**
 * 編集対象（新規登録、または登録済みクライアント）。
 */
export type EditTarget = { kind: "new" } | { kind: "existing"; client: OAuthClientDetail };

/**
 * 保存・削除の結果の通知。
 */
export type OAuthClientFeedback =
  | { kind: "created" | "saved" | "deleted" }
  | { kind: "saveFailed" | "deleteFailed"; error: unknown };

type LoadState = { status: "loading" } | { status: "ready" } | { status: "error"; error: unknown };

const oauthClientsPath = "/api/oauth-clients";

/**
 * 登録済みクライアント1件のBFFのpath。
 */
function oauthClientPath(clientId: string): string {
  return `${oauthClientsPath}/${encodeURIComponent(clientId)}`;
}

/**
 * 同じ編集対象か判定する。
 */
function isSameTarget(left: EditTarget | null, right: EditTarget): boolean {
  if (left === null || left.kind !== right.kind) return false;
  return left.kind === "new" || (right.kind === "existing" && left.client.clientId === right.client.clientId);
}

// --------------------------------------------------
// フック
// --------------------------------------------------

/**
 * OAuthクライアントの一覧を読み込み、選択したクライアントの編集・保存・削除を扱う。
 */
export function useOAuthClients() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [clients, setClients] = useState<OAuthClientDetail[]>([]);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [savedForm, setSavedForm] = useState<OAuthClientForm>(emptyOAuthClientForm);
  const [form, setForm] = useState<OAuthClientForm>(emptyOAuthClientForm);
  const [pendingTarget, setPendingTarget] = useState<EditTarget | null>(null);
  const [feedback, setFeedback] = useState<OAuthClientFeedback | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);

  const isDirty = editTarget !== null && !isSameOAuthClientForm(form, savedForm);
  const validation = parseOAuthClientForm(form);
  const canCreate = clients.length < oauthClientLimitPerUser;
  const canSave = isDirty && validation.input !== null && !isSaving;
  // 未変更の入力欄（新規登録の空欄など）には入力不備を表示しない。
  const fieldErrors: OAuthClientFieldErrors = isDirty
    ? validation.errors
    : { redirectUris: form.redirectUris.map(() => undefined) };

  // --------------------------------------------------
  // 編集対象の切替
  // --------------------------------------------------

  /**
   * 編集対象を開き、保存済みの内容を入力欄へ入れる。
   */
  const openEditor = (target: EditTarget | null) => {
    const nextForm = target?.kind === "existing" ? toOAuthClientForm(target.client) : emptyOAuthClientForm;
    setEditTarget(target);
    setSavedForm(nextForm);
    setForm(nextForm);
    setFeedback(null);
  };

  /**
   * 編集対象を切り替える。
   * 未保存の変更がある場合は切替先を保留し、確認を表示する。
   */
  const switchTarget = (target: EditTarget) => {
    if (isSameTarget(editTarget, target)) return;
    if (isDirty) {
      setPendingTarget(target);
      return;
    }
    openEditor(target);
  };

  const selectClient = (client: OAuthClientDetail) => switchTarget({ kind: "existing", client });

  const startCreating = () => {
    if (canCreate) switchTarget({ kind: "new" });
  };

  const discardAndSwitch = () => {
    if (pendingTarget !== null) openEditor(pendingTarget);
    setPendingTarget(null);
  };

  const keepEditing = () => setPendingTarget(null);

  // --------------------------------------------------
  // 読込み
  // --------------------------------------------------

  /**
   * 画面表示時と`reload`で一覧を読み込み、最初のクライアントを編集対象にする。
   */
  useEffect(() => {
    let isCurrent = true;
    setLoadState({ status: "loading" });
    requestBff(oauthClientsPath, oauthClientListSchema).then(
      (data) => {
        if (!isCurrent) return;
        setClients(data.clients);
        openEditor(data.clients[0] === undefined ? null : { kind: "existing", client: data.clients[0] });
        setLoadState({ status: "ready" });
      },
      (error: unknown) => {
        if (isCurrent) setLoadState({ status: "error", error });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [reloadCount]);

  // --------------------------------------------------
  // 入力
  // --------------------------------------------------

  /**
   * 入力欄を更新する。
   * 前回の保存結果の通知は入力内容と合わなくなるため消す。
   */
  const updateForm = (update: (current: OAuthClientForm) => OAuthClientForm) => {
    setForm(update);
    setFeedback(null);
  };

  const changeField = (field: OAuthClientTextField, value: string) =>
    updateForm((current) => ({ ...current, [field]: value }));

  const changeRedirectUri = (index: number, value: string) =>
    updateForm((current) => ({
      ...current,
      redirectUris: current.redirectUris.map((uri, uriIndex) => (uriIndex === index ? value : uri)),
    }));

  const addRedirectUri = () => updateForm((current) => ({ ...current, redirectUris: [...current.redirectUris, ""] }));

  const removeRedirectUri = (index: number) =>
    updateForm((current) => ({
      ...current,
      redirectUris: current.redirectUris.filter((_, uriIndex) => uriIndex !== index),
    }));

  // --------------------------------------------------
  // 保存・削除
  // --------------------------------------------------

  /**
   * 入力内容を登録または更新する。
   * 失敗した場合は入力内容を維持し、同じ内容で再度保存できるようにする。
   */
  const save = async () => {
    if (!canSave || validation.input === null || editTarget === null) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      if (editTarget.kind === "new") {
        const created = await requestBff(oauthClientsPath, oauthClientDetailSchema, {
          method: "POST",
          body: validation.input,
        });
        setClients((current) => [...current, created]);
        openEditor({ kind: "existing", client: created });
        setFeedback({ kind: "created" });
      } else {
        const updated = await requestBff(oauthClientPath(editTarget.client.clientId), oauthClientDetailSchema, {
          method: "PUT",
          body: validation.input,
        });
        setClients((current) => current.map((client) => (client.clientId === updated.clientId ? updated : client)));
        openEditor({ kind: "existing", client: updated });
        setFeedback({ kind: "saved" });
      }
    } catch (error) {
      setFeedback({ kind: "saveFailed", error });
    } finally {
      setIsSaving(false);
    }
  };

  const requestDelete = () => setIsDeleteConfirming(true);

  const cancelDelete = () => setIsDeleteConfirming(false);

  /**
   * 編集中のクライアントを削除し、編集対象を解除する。
   */
  const confirmDelete = async () => {
    if (editTarget?.kind !== "existing") return;
    const { clientId } = editTarget.client;
    setIsDeleting(true);
    try {
      await requestBff(oauthClientPath(clientId), okSchema, { method: "DELETE" });
      setClients((current) => current.filter((client) => client.clientId !== clientId));
      openEditor(null);
      setFeedback({ kind: "deleted" });
    } catch (error) {
      setFeedback({ kind: "deleteFailed", error });
    } finally {
      setIsDeleting(false);
      setIsDeleteConfirming(false);
    }
  };

  return {
    status: loadState.status,
    loadError: loadState.status === "error" ? loadState.error : null,
    reload: () => setReloadCount((count) => count + 1),
    clients,
    canCreate,
    editTarget,
    selectClient,
    startCreating,
    isSwitchConfirming: pendingTarget !== null,
    discardAndSwitch,
    keepEditing,
    form,
    fieldErrors,
    isDirty,
    changeField,
    changeRedirectUri,
    addRedirectUri,
    removeRedirectUri,
    canSave,
    isSaving,
    save,
    feedback,
    isDeleteConfirming,
    isDeleting,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}

export type OAuthClientsState = ReturnType<typeof useOAuthClients>;
