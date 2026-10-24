import type { AccountsProfileTarget } from "../../domain/verification/accounts-profile-url";
import { judgeProfileUrlEvidence } from "../../domain/verification/judge-profile-url-evidence";
import {
  failVerification,
  type VerificationOutcome,
} from "../../domain/verification/verification-result";
import { extractEvidenceUrls } from "./html-evidence-extractor";
import type { PageFetcher } from "./safe-page-fetcher";

/**
 * 外部ページのリンク・記述による証明（`bidirectional_link`）。
 * @see ../../../../docs/specification/v0.1/verify-url.ja.md
 * @see ./verify-link-evidence.worker.test.ts
 */

/**
 * リンク証明の試行結果。
 * `finalUrl`は取得できたページの最終取得URL（正規化済み）で、証拠URLとURL規則の適用に使う。取得できなければ`null`とする。
 */
export type LinkEvidenceOutcome = VerificationOutcome & { finalUrl: string | null };

/**
 * 入力URLのページを取得し、証拠候補に証明先の公開プロフィールURLがあるかを確かめる。
 * @param normalizedUrl `normalizeUrl`で正規化・検査済みの入力URL。
 * @param target 証明先のAccountsユーザー。
 * @param pageFetcher 外部ページの取得部品。
 */
export async function verifyLinkEvidence(
  normalizedUrl: string,
  target: AccountsProfileTarget,
  pageFetcher: PageFetcher,
): Promise<LinkEvidenceOutcome> {
  const fetched = await pageFetcher.fetchPage(normalizedUrl);
  if (!fetched.ok) return { ...fetched.failure, finalUrl: null };

  const { finalUrl } = fetched.page;
  const candidates = await extractEvidenceUrls(fetched.page).catch((error: unknown) => {
    // `HTMLRewriter`が扱えない文字コードや構文は、解釈できない応答としてリンク検証の結果にする。
    // 外部URLと例外のメッセージは出さず、例外名だけをログへ残す。
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.warn(JSON.stringify({ event: "external_page_parse_error", errorName }));
    return null;
  });
  if (candidates === null) return { ...failVerification("UNSUPPORTED_CONTENT_TYPE"), finalUrl };

  return {
    ...judgeProfileUrlEvidence(candidates, target, "LINK_NOT_FOUND"),
    finalUrl,
  };
}
