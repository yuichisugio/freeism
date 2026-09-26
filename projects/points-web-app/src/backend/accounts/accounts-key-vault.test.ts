import { describe, expect, it } from "vite-plus/test";

import {
  decryptAccountsSecret,
  encryptAccountsSecret,
  generateAccountsSigningKey,
  importAccountsKeyEncryptionKey,
  openAccountsSigningKey,
  sealAccountsSigningKey,
  toAccountsPublicJwks,
} from "./accounts-key-vault";

const kekBase64 = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
const otherKekBase64 = btoa(String.fromCharCode(...new Uint8Array(32).fill(8)));
const context = { connectionId: "acon_1", purpose: "client-assertion" } as const;

describe("KEKによる暗号化", () => {
  it("暗号化した値を同じ接続先・用途で復号できる", async () => {
    const kek = await importAccountsKeyEncryptionKey(kekBase64);

    const ciphertext = await encryptAccountsSecret(kek, context, "secret-value");

    expect(ciphertext).toMatch(/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/);
    expect(ciphertext).not.toContain("secret-value");
    await expect(decryptAccountsSecret(kek, context, ciphertext)).resolves.toBe("secret-value");
  });

  it("同じ値でも暗号化のたびに異なる暗号文になる", async () => {
    const kek = await importAccountsKeyEncryptionKey(kekBase64);

    const first = await encryptAccountsSecret(kek, context, "secret-value");
    const second = await encryptAccountsSecret(kek, context, "secret-value");

    expect(first).not.toBe(second);
  });

  it("別の接続先・別の用途・別のKEKでは復号できない", async () => {
    const kek = await importAccountsKeyEncryptionKey(kekBase64);
    const ciphertext = await encryptAccountsSecret(kek, context, "secret-value");

    await expect(
      decryptAccountsSecret(kek, { ...context, connectionId: "acon_2" }, ciphertext),
    ).rejects.toThrow();
    await expect(
      decryptAccountsSecret(kek, { ...context, purpose: "dpop" }, ciphertext),
    ).rejects.toThrow();
    await expect(
      decryptAccountsSecret(
        await importAccountsKeyEncryptionKey(otherKekBase64),
        context,
        ciphertext,
      ),
    ).rejects.toThrow();
  });

  it("32 bytesでないKEKを拒否する", async () => {
    await expect(importAccountsKeyEncryptionKey(btoa("short"))).rejects.toThrow(
      "ACCOUNTS_KEY_ENCRYPTION_KEY",
    );
  });
});

describe("署名鍵", () => {
  it("公開JWKは秘密値を含まず、kid・alg・useを持つ", async () => {
    const key = await generateAccountsSigningKey();

    expect(key.publicJwk).toEqual({
      kty: "OKP",
      crv: "Ed25519",
      x: expect.any(String),
      kid: expect.any(String),
      alg: "EdDSA",
      use: "sig",
    });
    expect(key.publicJwk).not.toHaveProperty("d");
    expect(toAccountsPublicJwks(key.publicJwk)).toEqual({ keys: [key.publicJwk] });
  });

  it("kidはJWK Thumbprint（RFC 7638）である", async () => {
    const key = await generateAccountsSigningKey();
    const { crv, kty, x } = key.publicJwk;
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify({ crv, kty, x })),
    );
    const thumbprint = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "");

    expect(key.publicJwk.kid).toBe(thumbprint);
  });

  it("暗号化して保存した秘密鍵を復号し、公開JWKで検証できる署名に使える", async () => {
    const kek = await importAccountsKeyEncryptionKey(kekBase64);
    const key = await generateAccountsSigningKey();

    const sealed = await sealAccountsSigningKey(kek, context, key);
    const opened = await openAccountsSigningKey(kek, context, sealed);

    expect(sealed).not.toContain(key.publicJwk.x);
    expect(opened.kid).toBe(key.publicJwk.kid);
    expect(opened.privateKey.extractable).toBe(false);
    const data = new TextEncoder().encode("payload");
    const signature = await crypto.subtle.sign("Ed25519", opened.privateKey, data);
    const verifier = await crypto.subtle.importKey(
      "jwk",
      { kty: "OKP", crv: "Ed25519", x: key.publicJwk.x },
      "Ed25519",
      false,
      ["verify"],
    );
    await expect(crypto.subtle.verify("Ed25519", verifier, signature, data)).resolves.toBe(true);
  });
});
