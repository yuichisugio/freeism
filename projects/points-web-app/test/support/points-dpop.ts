export interface DpopTestKey {
  privateKey: CryptoKey;
  publicJwk: JsonWebKey;
}

export async function generateDpopTestKey(): Promise<DpopTestKey> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const { kty, crv, x } = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  return { privateKey: pair.privateKey, publicJwk: { kty, crv, x } };
}

/** トークン取得と資源APIの双方に使うDPoP proofを署名する。 */
export async function createDpopTestProof(
  key: DpopTestKey,
  { method, url, accessToken }: { method: string; url: string; accessToken?: string },
): Promise<string> {
  const encode = (value: string | Uint8Array) =>
    Buffer.from(typeof value === "string" ? new TextEncoder().encode(value) : value).toString(
      "base64url",
    );
  const ath = accessToken
    ? encode(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(accessToken)),
        ),
      )
    : undefined;
  const header = encode(JSON.stringify({ alg: "EdDSA", typ: "dpop+jwt", jwk: key.publicJwk }));
  const payload = encode(
    JSON.stringify({
      htm: method,
      htu: url,
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomUUID(),
      ath,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: "Ed25519" },
    key.privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${encode(new Uint8Array(signature))}`;
}
