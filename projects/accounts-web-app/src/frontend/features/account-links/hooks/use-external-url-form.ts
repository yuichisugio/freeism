import { useState } from "react";
import * as v from "valibot";

import {
  externalUrlSchema,
  saveUnverifiedUrlResultSchema,
  verifyUrlResultSchema,
} from "../../../../shared/schemas/external-url-schema";
import type {
  ExternalUrlMode,
  SaveUnverifiedUrlResult,
  VerifyUrlResult,
} from "../../../../shared/schemas/external-url-schema";
import { BffError, requestBff } from "../../../lib/api-client";

/**
 * 外部URLの入力と「保存して検証する」「未検証で保存」。
 * @see ../../../../../docs/specification/v0.1/verify-url.ja.md
 * @see ./use-external-url-form.test.tsx
 */

export type ExternalUrlOutcome =
  | { mode: "verify"; result: VerifyUrlResult }
  | { mode: "unverified"; result: SaveUnverifiedUrlResult };

type SubmitState =
  | { status: "idle" }
  | { status: "submitting"; mode: ExternalUrlMode }
  | { status: "succeeded"; outcome: ExternalUrlOutcome }
  | { status: "failed"; error: unknown };

/**
 * ブラウザーで検出する入力不備。
 * URLの構文・取得先の安全性はバックエンドが検査する。
 */
export type UrlValidationError = "required" | "tooLong";

/**
 * 外部URLの登録・検証フォームの状態と操作。
 * 保存に成功したら`onSaved`で一覧を再取得する。
 */
export function useExternalUrlForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const [url, setUrlState] = useState("");
  const [validationError, setValidationError] = useState<UrlValidationError | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  /**
   * 入力を変更する。
   * 前回の送信の失敗は入力内容と合わなくなるため消す。
   */
  const setUrl = (value: string) => {
    setUrlState(value);
    setValidationError(null);
    setSubmitState((current) => (current.status === "failed" ? { status: "idle" } : current));
  };

  /**
   * 入力したURLを保存する。
   * `verify`はリンク証明とDNS TXTを試し、`unverified`は検証せずに登録する。
   * 未登録URLの検証が成立せず登録されなかった場合は、続けて「未検証で保存」できるよう入力を保つ。
   */
  const submit = async (mode: ExternalUrlMode) => {
    const parsed = v.safeParse(externalUrlSchema, { url, mode });
    if (!parsed.success) {
      setValidationError(url.trim() === "" ? "required" : "tooLong");
      return;
    }
    setSubmitState({ status: "submitting", mode });
    try {
      const outcome: ExternalUrlOutcome =
        mode === "verify"
          ? {
              mode,
              result: await requestBff("/api/external-urls", verifyUrlResultSchema, {
                method: "POST",
                body: parsed.output,
              }),
            }
          : {
              mode,
              result: await requestBff("/api/external-urls", saveUnverifiedUrlResultSchema, {
                method: "POST",
                body: parsed.output,
              }),
            };
      setSubmitState({ status: "succeeded", outcome });
      if (outcome.mode === "verify" && outcome.result.externalAccountId === null) {
        return;
      }
      setUrlState("");
      await onSaved();
    } catch (error) {
      setSubmitState({ status: "failed", error });
    }
  };

  const error = submitState.status === "failed" ? submitState.error : null;

  return {
    url,
    setUrl,
    validationError,
    submit,
    submittingMode: submitState.status === "submitting" ? submitState.mode : null,
    outcome: submitState.status === "succeeded" ? submitState.outcome : null,
    error,
    /**
     * バックエンドが返したURL入力の不備（`errors[].path`が`url`）のコード。
     */
    urlInputErrorCode:
      error instanceof BffError ? (error.problem?.errors?.find((issue) => issue.path?.[0] === "url")?.code ?? null) : null,
  };
}
