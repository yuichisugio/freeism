import { exportJWK, generateKeyPair, importJWK, calculateJwkThumbprint, type JWK } from "jose";

type Purpose = "client-assertion" | "dpop";

export async function importPointsKeyEncryptionKey(secret: string): Promise<CryptoKey> {
  const bytes = Uint8Array.from(atob(secret), (character) => character.charCodeAt(0));
  if (bytes.length !== 32) throw new Error("POINTS_KEY_ENCRYPTION_KEY_INVALID");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function decodeBase64Url(encoded: string): Uint8Array<ArrayBuffer> {
  const value = atob(encoded.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

function additionalData(providerId: string, purpose: Purpose) {
  return new TextEncoder().encode(`markets-points-provider:${providerId}:${purpose}`);
}

/** 接続先と用途をAADへ結び付け、秘密JWKを保存する。 */
export async function sealPointsProviderKey(
  kek: CryptoKey,
  providerId: string,
  purpose: Purpose,
  privateJwk: JWK,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: additionalData(providerId, purpose) },
    kek,
    new TextEncoder().encode(JSON.stringify(privateJwk)),
  );
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(ciphertext))}`;
}

export async function openPointsProviderKey(
  kek: CryptoKey,
  providerId: string,
  purpose: Purpose,
  sealed: string,
): Promise<JWK> {
  const [version, iv, ciphertext] = sealed.split(".");
  if (version !== "v1" || !iv || !ciphertext) throw new Error("POINTS_PROVIDER_KEY_INVALID");
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decodeBase64Url(iv),
      additionalData: additionalData(providerId, purpose),
    },
    kek,
    decodeBase64Url(ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as JWK;
}

/** Ed25519署名鍵を生成し、公開JWKのthumbprintをkidにする。 */
export async function generatePointsProviderKey() {
  const pair = await generateKeyPair("EdDSA", { extractable: true, crv: "Ed25519" });
  const privateJwk = await exportJWK(pair.privateKey);
  const publicJwk = await exportJWK(pair.publicKey);
  const kid = await calculateJwkThumbprint(publicJwk);
  return {
    privateJwk: { ...privateJwk, kid },
    publicJwk: { ...publicJwk, kid, alg: "EdDSA", use: "sig" },
  };
}

export async function importPointsProviderSigningKey(jwk: JWK): Promise<CryptoKey> {
  return importJWK(jwk, "EdDSA") as Promise<CryptoKey>;
}
