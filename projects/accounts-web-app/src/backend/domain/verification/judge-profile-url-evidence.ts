import {
  type AccountsProfileTarget,
  buildAccountsProfileUrl,
  buildAccountsProfileUrlPrefix,
} from "./accounts-profile-url";
import { failVerification, type VerificationOutcome, verifiedOutcome } from "./verification-result";

/**
 * 証拠候補と期待する公開プロフィールURLの一致判定。
 * リンク証明とDNS TXTで同じ規則を使う。
 * @see ../../../../docs/specification/v0.1/verify-url.ja.md
 * @see ./judge-profile-url-evidence.test.ts
 */

/**
 * 正規化済みの証拠候補から、期待する公開プロフィールURLとの完全一致を判定する。
 * 期待URLと同じAccountsサービスの異なるユーザーのプロフィールURLが併存する場合は判断不能とする。
 * 同一URLの繰り返しは1件として数える。
 * @param normalizedCandidates `normalizeUrl`で正規化した証拠候補。
 * @param target 証明先のAccountsユーザー。
 * @param notFoundCode 期待URLが無い場合の`failure_code`（リンク証明は`LINK_NOT_FOUND`、DNS TXTは`TXT_NOT_FOUND`）。
 */
export function judgeProfileUrlEvidence(
  normalizedCandidates: readonly string[],
  target: AccountsProfileTarget,
  notFoundCode: "LINK_NOT_FOUND" | "TXT_NOT_FOUND",
): VerificationOutcome {
  const expectedUrl = buildAccountsProfileUrl(target);
  const candidates = new Set(normalizedCandidates);
  if (!candidates.has(expectedUrl)) return failVerification(notFoundCode);

  const profileUrlPrefix = buildAccountsProfileUrlPrefix(target.accountsOrigin);
  const hasOtherUserProfile = [...candidates].some(
    (candidate) => candidate !== expectedUrl && isAccountsProfileUrl(candidate, profileUrlPrefix),
  );
  return hasOtherUserProfile ? failVerification("MULTIPLE_ACCOUNTS_PROFILES") : verifiedOutcome;
}

/**
 * URLが`{origin}/profiles/{id}`の形の公開プロフィールURLかを判定する。
 * `{id}`はAccountsユーザーIDに使う文字（base64urlと`_`）だけから成るものに限る。
 * 本文でURLの直後に続いた日本語などを含む候補は、別ユーザーのプロフィールURLとして数えない。
 */
function isAccountsProfileUrl(url: string, profileUrlPrefix: string): boolean {
  return (
    url.startsWith(profileUrlPrefix) && /^[A-Za-z0-9_-]+$/.test(url.slice(profileUrlPrefix.length))
  );
}
