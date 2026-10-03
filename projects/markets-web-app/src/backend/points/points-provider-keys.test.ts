import { describe, expect, it } from "vitest";

import {
  generatePointsProviderKey,
  importPointsKeyEncryptionKey,
  openPointsProviderKey,
  sealPointsProviderKey,
} from "./points-provider-keys";
import { parsePointsProviderOrigin } from "./points-provider-origin";

describe("Points provider origin", () => {
  it("accepts HTTPS origin and local loopback HTTP only", () => {
    expect(parsePointsProviderOrigin("https://points.example.test/", false)).toBe(
      "https://points.example.test",
    );
    expect(parsePointsProviderOrigin("http://localhost:3000", true)).toBe("http://localhost:3000");
    expect(parsePointsProviderOrigin("http://points.example.test", true)).toBeNull();
    expect(parsePointsProviderOrigin("https://points.example.test/path", false)).toBeNull();
    expect(parsePointsProviderOrigin("https://user@points.example.test", false)).toBeNull();
  });
});

describe("Points provider secret keys", () => {
  it("seals generated Ed25519 private keys to one provider and purpose", async () => {
    const secret = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    const kek = await importPointsKeyEncryptionKey(secret);
    const key = await generatePointsProviderKey();
    const sealed = await sealPointsProviderKey(kek, "ppr_a", "client-assertion", key.privateJwk);
    expect(sealed).not.toContain(key.privateJwk.d!);
    expect(await openPointsProviderKey(kek, "ppr_a", "client-assertion", sealed)).toEqual(
      key.privateJwk,
    );
    await expect(openPointsProviderKey(kek, "ppr_b", "client-assertion", sealed)).rejects.toThrow();
    await expect(openPointsProviderKey(kek, "ppr_a", "dpop", sealed)).rejects.toThrow();
  });
});
