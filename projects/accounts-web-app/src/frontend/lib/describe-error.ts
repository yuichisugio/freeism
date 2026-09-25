import { BffError } from "./api-client";
import type { CommonMessages } from "./i18n/common-messages";

/**
 * 操作の失敗を利用者向けの文言にする。
 * 画面ごとのエラーコードの文言を優先し、無ければHTTPステータスから共通の文言を選ぶ。
 */
export function describeError(
  error: unknown,
  common: CommonMessages,
  codeMessages: Partial<Record<string, string>> = {},
): string {
  if (!(error instanceof BffError)) {
    // fetchの通信失敗はTypeError、応答が契約の形でない場合はJSON構文・schemaの検査エラーになる。
    return error instanceof TypeError ? common.networkError : common.unexpectedResponse;
  }
  const codeMessage = error.code === null ? undefined : codeMessages[error.code];
  if (codeMessage !== undefined) return codeMessage;
  switch (error.status) {
    case 401:
      return common.unauthorized;
    case 403:
      return common.forbidden;
    case 404:
      return common.notFound;
    case 429:
      return common.rateLimited;
    default:
      return common.unexpected(error.status);
  }
}

/**
 * 失敗がログインしていないことによるものかを判定する。
 */
export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof BffError && error.status === 401;
}
