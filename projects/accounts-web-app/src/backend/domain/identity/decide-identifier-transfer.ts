import type { VerificationMethod } from "./verification-method";

/**
 * 他ユーザーが有効に保持する識別子を、今回の本人へ移動するかの判定結果。
 */
export type IdentifierTransferDecision = "move" | "blocked";

/**
 * 今回成功した証明方法と、旧所有者側でその識別子を支える成功証明の方法から、Web識別子を移動するかを決める。
 * リンク証明単独の成功では、`oauth`または`dns_txt`が支える識別子を移動しない。
 * OAuth固有IDは移動の対象外のため、呼出側で渡さない。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ./decide-identifier-transfer.test.ts
 */
export function decideIdentifierTransfer(
  method: VerificationMethod,
  currentOwnerSupport: readonly VerificationMethod[],
): IdentifierTransferDecision {
  if (method !== "bidirectional_link") {
    return "move";
  }

  return currentOwnerSupport.some((support) => support === "oauth" || support === "dns_txt")
    ? "blocked"
    : "move";
}
