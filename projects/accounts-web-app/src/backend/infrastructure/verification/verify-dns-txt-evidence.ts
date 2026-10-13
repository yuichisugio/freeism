import { resolveTxt as resolveTxtWithNodeDns } from "node:dns/promises";

import type { AccountsProfileTarget } from "../../domain/verification/accounts-profile-url";
import { classifyDnsError } from "../../domain/verification/classify-lookup-failure";
import { judgeProfileUrlEvidence } from "../../domain/verification/judge-profile-url-evidence";
import { normalizeUrl } from "../../domain/verification/normalize-url";
import {
  failVerification,
  type VerificationOutcome,
} from "../../domain/verification/verification-result";

/**
 * DNS TXTによるドメイン所有権の証明。
 * @see ../../../../docs/specification/v0.1/verify-url.ja.md
 * @see ./verify-dns-txt-evidence.test.ts
 */

/**
 * TXTレコードを照会する関数。
 * 各レコードはcharacter-stringの配列で返る。
 */
export type ResolveTxt = (name: string) => Promise<string[][]>;

/**
 * DNS TXTの照会の設定。
 * テストでは`resolveTxt`を差し替え、実際のDNSへ照会しない。
 */
export type DnsTxtLookupOptions = {
  resolveTxt?: ResolveTxt;
  timeoutMilliseconds?: number;
};

/**
 * DNS照会の期限。
 * 外部ページの取得期限とは別に数える。
 */
const defaultDnsTimeoutMilliseconds = 3000;

/**
 * `_accounts.{host}`のTXTレコードに、証明先の公開プロフィールURLがあるかを確かめる。
 * 各レコードのcharacter-stringを連結して正規化し、URLとして解釈できない行（CNAMEの行など）は無視する。
 * @param host `normalizeUrl`で正規化したhost。
 * @param target 証明先のAccountsユーザー。
 */
export async function verifyDnsTxtEvidence(
  host: string,
  target: AccountsProfileTarget,
  {
    resolveTxt = resolveTxtWithNodeDns,
    timeoutMilliseconds = defaultDnsTimeoutMilliseconds,
  }: DnsTxtLookupOptions = {},
): Promise<VerificationOutcome> {
  const timedOut = Symbol("timedOut");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof timedOut>((resolve) => {
    timer = setTimeout(() => resolve(timedOut), timeoutMilliseconds);
  });

  try {
    const records = await Promise.race([resolveTxt(`_accounts.${host}`), timeout]);
    if (records === timedOut) return failVerification("DNS_TIMEOUT");

    const candidates = records.flatMap((characterStrings) => {
      const normalized = normalizeUrl(characterStrings.join(""));
      return normalized.ok ? [normalized.url] : [];
    });
    return judgeProfileUrlEvidence(candidates, target, "TXT_NOT_FOUND");
  } catch (error) {
    return classifyDnsError(error);
  } finally {
    clearTimeout(timer);
  }
}
