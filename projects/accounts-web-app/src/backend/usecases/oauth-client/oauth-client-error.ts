import { isAPIError } from "better-auth/api";

import { ProblemError } from "../../problem-details";

/**
 * OAuthクライアント管理の失敗の種類ごとのHTTPステータス。
 */
const oauthClientErrorStatuses = {
  CLIENT_NOT_FOUND: 404,
  CLIENT_LIMIT_REACHED: 409,
  INVALID_JWKS: 400,
  INVALID_CLIENT_METADATA: 400,
  CLIENT_KEY_SAVE_FAILED: 500,
} as const;

/**
 * OAuthクライアント管理の失敗の種類。
 */
export type OAuthClientErrorCode = keyof typeof oauthClientErrorStatuses;

/**
 * OAuthクライアント管理で、本人へ理由を示して拒否する失敗。
 * `detail`はBetter Authの標準検査が返した説明（英語）で、本人の入力値（リダイレクトURLなど）を含むことがある。
 */
export class OAuthClientError extends ProblemError {
  constructor(
    override readonly code: OAuthClientErrorCode,
    detail?: string,
  ) {
    super(oauthClientErrorStatuses[code], code, undefined, detail);
    this.name = "OAuthClientError";
  }
}

/**
 * Better Authの標準APIの拒否を`OAuthClientError`へ変換する。
 * 他人のクライアントは存在を明かさないよう、未登録と同じ`CLIENT_NOT_FOUND`にする。
 * それ以外の失敗はそのまま返す。
 */
export function toOAuthClientError(error: unknown): unknown {
  if (!isAPIError(error)) {
    return error;
  }
  if (error.status === "NOT_FOUND" || error.status === "UNAUTHORIZED") {
    return new OAuthClientError("CLIENT_NOT_FOUND");
  }
  if (error.status === "BAD_REQUEST") {
    const description = (error.body as { error_description?: unknown } | undefined)
      ?.error_description;
    return new OAuthClientError(
      "INVALID_CLIENT_METADATA",
      typeof description === "string" ? description : undefined,
    );
  }
  return error;
}
