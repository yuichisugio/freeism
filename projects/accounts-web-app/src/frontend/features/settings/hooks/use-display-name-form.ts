import { useState } from "react";
import * as v from "valibot";

import { displayNameSchema, meSchema } from "../../../../shared/schemas/profile-schema";
import { requestBff } from "../../../lib/api-client";
import { authClient } from "../../../lib/auth-client";
import { useBffResource } from "./use-bff-resource";

/**
 * 表示名の入力不備。
 */
export type DisplayNameIssue = "required" | "tooLong";

/**
 * 「設定」画面の表示名の編集と保存。
 * 未編集の間は保存済みの表示名を表示し、編集中の値と異なる場合を未保存の変更として扱う。
 * 保存後は、ヘッダー・アカウントのメニューの表示名を更新するため、現在のセッションを読み直させる。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./use-display-name-form.test.tsx
 */
export function useDisplayNameForm() {
  const me = useBffResource("/api/me", meSchema);
  const [draft, setDraft] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);

  const savedDisplayName = me.data?.displayName ?? "";
  const displayName = draft ?? savedDisplayName;
  const isDirty = me.data !== null && draft !== null && draft !== savedDisplayName;
  const issue = isDirty ? findDisplayNameIssue(displayName) : null;

  const changeDisplayName = (value: string) => {
    setDraft(value);
    setIsSaved(false);
    setSaveError(null);
  };

  const save = async () => {
    const parsed = v.safeParse(displayNameSchema, displayName);
    if (!parsed.success) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const saved = await requestBff("/api/profile", meSchema, {
        method: "PATCH",
        body: { displayName: parsed.output },
      });
      me.replaceData(saved);
      setDraft(null);
      setIsSaved(true);
      authClient.$store.notify("$sessionSignal");
    } catch (error) {
      setSaveError(error);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    me: me.data,
    loadError: me.error,
    isLoading: me.isLoading,
    reload: me.reload,
    displayName,
    issue,
    isDirty,
    canSave: isDirty && issue === null && !isSaving,
    isSaving,
    isSaved,
    saveError,
    changeDisplayName,
    save,
  };
}

export type DisplayNameForm = ReturnType<typeof useDisplayNameForm>;

/**
 * 表示名の入力不備を返す。
 */
function findDisplayNameIssue(value: string): DisplayNameIssue | null {
  const result = v.safeParse(displayNameSchema, value);
  if (result.success) return null;
  return result.issues[0].type === "non_empty" ? "required" : "tooLong";
}
