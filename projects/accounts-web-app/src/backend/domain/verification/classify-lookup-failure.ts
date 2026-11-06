import { failVerification, type VerificationFailure } from "./verification-result";

/**
 * 外部ページの取得とDNS TXTの照会で起きた失敗の分類。
 * 対象が存在しないことを確認できた場合は`not_verified`、判断できない場合は`indeterminate`とする。
 * @see ../../../../docs/specification/v0.1/verify-url.ja.md
 * @see ./classify-lookup-failure.test.ts
 */

/**
 * 成功以外のHTTPステータスを分類する。
 * 404・410はページが無いことを確認できたため`not_verified`、アクセス制限とその他の失敗は`indeterminate`とする。
 */
export function classifyHttpStatus(status: number): VerificationFailure {
  if (status === 404 || status === 410) return failVerification("PAGE_NOT_FOUND");
  if (status === 401 || status === 403 || status === 429)
    return failVerification("ACCESS_RESTRICTED");
  return failVerification("HTTP_ERROR");
}

/**
 * `node:dns/promises`の`resolveTxt`が投げた例外を分類する。
 * NXDOMAIN・NODATA（`ENOTFOUND`・`ENODATA`）は一致するTXTが無いものとし、その他は照会の失敗とする。
 * Workersの実装はDNS over HTTPSの応答に回答が無ければ`ENOTFOUND`、HTTPの失敗は`EBADRESP`、通信の失敗は`EBADQUERY`を投げる。
 */
export function classifyDnsError(error: unknown): VerificationFailure {
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  return code === "ENOTFOUND" || code === "ENODATA"
    ? failVerification("TXT_NOT_FOUND")
    : failVerification("DNS_LOOKUP_FAILED");
}
