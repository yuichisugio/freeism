import { isAPIError } from "better-auth/api";

/**
 * OAuthクライアント管理の失敗の種類。
 */
export type OAuthClientErrorCode =
  | "CLIENT_NOT_FOUND"
  | "CLIENT_LIMIT_REACHED"
  | "INVALID_JWKS"
  | "INVALID_CLIENT_METADATA"
  | "CLIENT_KEY_SAVE_FAILED";

/**
 * OAuthクライアント管理で、本人へ理由を示して拒否する失敗。
 * `detail`はBetter Authの標準検査が返した説明（英語）で、本人の入力値（リダイレクトURLなど）を含むことがある。
 */
export class OAuthClientError extends Error {
  constructor(
    readonly code: OAuthClientErrorCode,
    readonly detail?: string,
  ) {
    super(detail ?? code);
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
