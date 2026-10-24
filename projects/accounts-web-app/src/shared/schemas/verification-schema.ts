import * as v from "valibot";

/**
 * 証明方法・試行結果・`failure_code`の値。
 * @see ../../../docs/specification/v0.1/verify-url.ja.md
 */

/**
 * 所有権の証明方法。
 */
export const verificationMethodSchema = v.picklist(["oauth", "bidirectional_link", "dns_txt"]);

/**
 * 直近の試行の結果。
 */
export const verificationResultSchema = v.picklist(["verified", "not_verified", "indeterminate"]);

/**
 * 外部アカウントに本人への有効な証明済み紐付けがあるか。
 */
export const verificationStatusSchema = v.picklist(["verified", "unverified"]);

/**
 * 直近の試行が成功しなかった理由。
 * 画面はこの値から本人の次の操作の案内を導く。
 */
export const verificationFailureCodeSchema = v.picklist([
  "LINK_NOT_FOUND",
  "PAGE_NOT_FOUND",
  "REDIRECT_TARGET_BLOCKED",
  "TOO_MANY_REDIRECTS",
  "ACCESS_RESTRICTED",
  "HTTP_ERROR",
  "FETCH_TIMEOUT",
  "NETWORK_ERROR",
  "RESPONSE_TOO_LARGE",
  "UNSUPPORTED_CONTENT_TYPE",
  "HELD_BY_STRONGER_PROOF",
  "TXT_NOT_FOUND",
  "DNS_TIMEOUT",
  "DNS_LOOKUP_FAILED",
  "MULTIPLE_ACCOUNTS_PROFILES",
]);

export type VerificationMethod = v.InferOutput<typeof verificationMethodSchema>;
export type VerificationResult = v.InferOutput<typeof verificationResultSchema>;
export type VerificationFailureCode = v.InferOutput<typeof verificationFailureCodeSchema>;
