/**
 * 証明の試行結果と`failure_code`の定義。
 * 失敗の種類ごとに結果（`not_verified`・`indeterminate`）を1つに決め、結果と`failure_code`の組合せを揃える。
 * @see ../../../../docs/specification/v0.1/verify-url.ja.md
 */

// --------------------------------------------------
// failure_code
// --------------------------------------------------

/**
 * `failure_code`ごとの試行結果。
 * `not_verified`は対象を取得・解釈できたが期待する証拠が無かった場合、`indeterminate`は判断できなかった場合を表す。
 */
const failureCodeResults = {
  // リンク証明
  LINK_NOT_FOUND: "not_verified",
  PAGE_NOT_FOUND: "not_verified",
  REDIRECT_TARGET_BLOCKED: "not_verified",
  TOO_MANY_REDIRECTS: "indeterminate",
  ACCESS_RESTRICTED: "indeterminate",
  HTTP_ERROR: "indeterminate",
  FETCH_TIMEOUT: "indeterminate",
  NETWORK_ERROR: "indeterminate",
  RESPONSE_TOO_LARGE: "indeterminate",
  UNSUPPORTED_CONTENT_TYPE: "indeterminate",
  HELD_BY_STRONGER_PROOF: "indeterminate",
  // DNS TXT
  TXT_NOT_FOUND: "not_verified",
  DNS_TIMEOUT: "indeterminate",
  DNS_LOOKUP_FAILED: "indeterminate",
  // リンク証明・DNS TXT共通
  MULTIPLE_ACCOUNTS_PROFILES: "indeterminate",
} as const satisfies Record<string, "not_verified" | "indeterminate">;

/**
 * 直近の試行が成功しなかった理由。
 * 画面は、この値から本人の次の操作の案内を導く。
 */
export type VerificationFailureCode = keyof typeof failureCodeResults;

/**
 * 直近の試行の結果。
 */
export type VerificationResult = "verified" | "not_verified" | "indeterminate";

/**
 * 1回の証明の試行結果。
 * 成功時は`failureCode`を持たず、失敗・判断不能時は結果に対応する`failureCode`を持つ。
 */
export type VerificationOutcome = { result: "verified"; failureCode: null } | VerificationFailure;

/**
 * 成功しなかった試行結果。
 */
export type VerificationFailure = {
  result: "not_verified" | "indeterminate";
  failureCode: VerificationFailureCode;
};

// --------------------------------------------------
// 結果の組立て
// --------------------------------------------------

/**
 * 成功した試行結果。
 */
export const verifiedOutcome = {
  result: "verified",
  failureCode: null,
} as const satisfies VerificationOutcome;

/**
 * `failure_code`から、対応する結果を持つ試行結果を作る。
 */
export function failVerification(failureCode: VerificationFailureCode): VerificationFailure {
  return { result: failureCodeResults[failureCode], failureCode };
}
