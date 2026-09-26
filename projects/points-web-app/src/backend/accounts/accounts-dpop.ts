import { DPoP, isDPoPNonceError, modifyAssertion, type DPoPHandle } from "oauth4webapi";

import type { AccountsSigningKeyPair } from "./accounts-key-vault";

/**
 * DPoP（RFC 9449）のproof生成。
 * proofの`htm`・`htu`（queryを除くURL）・`iat`・`jti`、資源APIでの`ath`はoauth4webapiが付ける。
 * @see https://www.rfc-editor.org/rfc/rfc9449.html
 * @see ./accounts-oauth-client.test.ts
 */

// --------------------------------------------------
// DPoP
// --------------------------------------------------

/**
 * DPoP proofを作るhandleを作る。
 * oauth4webapiはEd25519鍵の`alg`を`Ed25519`にするため、Accountsが受け付ける`EdDSA`に置き換える。
 * handleは受け取った`DPoP-Nonce`をoriginごとに覚え、次のproofの`nonce`に入れる。
 */
export function createAccountsDpopHandle(dpopKey: AccountsSigningKeyPair): DPoPHandle {
  return DPoP({}, dpopKey, {
    [modifyAssertion]: (header) => {
      header.alg = "EdDSA";
    },
  });
}

/**
 * DPoP-Nonceを要求された場合に、受け取ったnonceで1回だけ送り直す（RFC 9449 §8・§9）。
 */
export async function withDpopNonceRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isDPoPNonceError(error)) throw error;
    return operation();
  }
}
