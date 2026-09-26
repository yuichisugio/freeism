import { decodeBase64Url, encodeBase64Url } from "./base64url";

/**
 * 接続先ごとの秘密値（署名鍵・Access Token）の暗号化と、署名鍵の生成。
 * KEKはWorker secret `ACCOUNTS_KEY_ENCRYPTION_KEY`（base64の32 bytes）で、AES-256-GCMで暗号化する。
 * AADに接続先IDと用途を入れ、行や用途の差し替えを復号の失敗として検出する。
 * @see ../../../docs/v0.2/details-ja/profile-setting.md
 * @see ./accounts-key-vault.test.ts
 */

// --------------------------------------------------
// KEKによる暗号化
// --------------------------------------------------

/**
 * 暗号化する秘密値の用途。
 */
export type AccountsSecretPurpose = "client-assertion" | "dpop" | "access-token";

/**
 * 秘密値を結び付ける接続先と用途。
 */
export type AccountsSecretContext = {
  connectionId: string;
  purpose: AccountsSecretPurpose;
};

const ciphertextVersion = "v1";
const ivByteLength = 12;

/**
 * base64のKEKをAES-GCMの鍵として読み込む。
 */
export async function importAccountsKeyEncryptionKey(secretBase64: string): Promise<CryptoKey> {
  const bytes = Uint8Array.from(atob(secretBase64), (character) => character.charCodeAt(0));
  if (bytes.byteLength !== 32) {
    throw new Error("ACCOUNTS_KEY_ENCRYPTION_KEY must be 32 bytes encoded in base64");
  }
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toAdditionalData({
  connectionId,
  purpose,
}: AccountsSecretContext): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`accounts-connection:${connectionId}:${purpose}`);
}

/**
 * 秘密値を暗号化し、`v1.{iv}.{ciphertext}`（base64url）の形で返す。
 */
export async function encryptAccountsSecret(
  kek: CryptoKey,
  context: AccountsSecretContext,
  plaintext: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(ivByteLength));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: toAdditionalData(context) },
    kek,
    new TextEncoder().encode(plaintext),
  );
  return `${ciphertextVersion}.${encodeBase64Url(iv)}.${encodeBase64Url(new Uint8Array(ciphertext))}`;
}

/**
 * `encryptAccountsSecret`の暗号文を復号する。
 * 接続先・用途・KEKのいずれかが暗号化時と異なる場合は例外を投げる。
 */
export async function decryptAccountsSecret(
  kek: CryptoKey,
  context: AccountsSecretContext,
  sealed: string,
): Promise<string> {
  const [version, iv, ciphertext] = sealed.split(".");
  if (version !== ciphertextVersion || iv === undefined || ciphertext === undefined) {
    throw new Error("Unsupported Accounts secret format");
  }
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64Url(iv), additionalData: toAdditionalData(context) },
    kek,
    decodeBase64Url(ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}

// --------------------------------------------------
// 署名鍵（Ed25519）
// --------------------------------------------------

/**
 * Accountsへ登録する公開JWK。
 */
export type AccountsPublicJwk = {
  kty: "OKP";
  crv: "Ed25519";
  x: string;
  kid: string;
  alg: "EdDSA";
  use: "sig";
};

/**
 * 生成した署名鍵。
 * `privateJwk`は`d`を含むため、保存前に必ず暗号化する。
 */
export type AccountsSigningKey = {
  publicJwk: AccountsPublicJwk;
  privateJwk: JsonWebKey & { kid: string };
};

/**
 * 署名に使う鍵の組。
 * 秘密鍵は取り出せない形で読み込み、公開鍵はDPoP proofの`jwk`を作るため取り出せる形にする。
 */
export type AccountsSigningKeyPair = {
  kid: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
};

/**
 * 公開JWKのJWK Thumbprint（RFC 7638、SHA-256）。
 */
async function calculateJwkThumbprint({ crv, kty, x }: { crv: string; kty: string; x: string }) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify({ crv, kty, x })),
  );
  return encodeBase64Url(new Uint8Array(digest));
}

/**
 * Ed25519の署名鍵を生成する。
 * `kid`はJWK Thumbprintにする。
 */
export async function generateAccountsSigningKey(): Promise<AccountsSigningKey> {
  const keyPair = (await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const {
    kty = "OKP",
    crv = "Ed25519",
    x = "",
    d,
  } = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const kid = await calculateJwkThumbprint({ crv, kty, x });
  return {
    publicJwk: { kty: "OKP", crv: "Ed25519", x, kid, alg: "EdDSA", use: "sig" },
    privateJwk: { kty, crv, x, d, kid },
  };
}

/**
 * Accountsの開発者向け画面へ登録するインラインJWK Set。
 */
export function toAccountsPublicJwks(publicJwk: AccountsPublicJwk): { keys: [AccountsPublicJwk] } {
  return { keys: [publicJwk] };
}

/**
 * 秘密JWKから署名に使う鍵の組を読み込む。
 */
export async function importAccountsSigningKeyPair({
  kty,
  crv,
  x,
  d,
  kid,
}: AccountsSigningKey["privateJwk"]): Promise<AccountsSigningKeyPair> {
  const [privateKey, publicKey] = await Promise.all([
    crypto.subtle.importKey("jwk", { kty, crv, x, d }, "Ed25519", false, ["sign"]),
    crypto.subtle.importKey("jwk", { kty, crv, x }, "Ed25519", true, ["verify"]),
  ]);
  return { kid, privateKey, publicKey };
}

/**
 * 署名鍵の秘密JWKを暗号化する。
 */
export function sealAccountsSigningKey(
  kek: CryptoKey,
  context: AccountsSecretContext,
  key: AccountsSigningKey,
): Promise<string> {
  return encryptAccountsSecret(kek, context, JSON.stringify(key.privateJwk));
}

/**
 * 暗号化した秘密JWKを復号し、署名に使う鍵の組として読み込む。
 */
export async function openAccountsSigningKey(
  kek: CryptoKey,
  context: AccountsSecretContext,
  sealed: string,
): Promise<AccountsSigningKeyPair> {
  const privateJwk = JSON.parse(
    await decryptAccountsSecret(kek, context, sealed),
  ) as AccountsSigningKey["privateJwk"];
  return importAccountsSigningKeyPair(privateJwk);
}
