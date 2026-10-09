import { describe, expect, it } from "vite-plus/test";

import { parseAccountsOrigin, toAccountsResourceIdentifier } from "./accounts-origin";

describe("parseAccountsOrigin", () => {
  it("HTTPSのoriginを正規化して返す", () => {
    expect(parseAccountsOrigin("https://Accounts.Example.test", { allowLoopbackHttp: false })).toBe(
      "https://accounts.example.test",
    );
    expect(
      parseAccountsOrigin("https://accounts.example.test/", { allowLoopbackHttp: false }),
    ).toBe("https://accounts.example.test");
    expect(
      parseAccountsOrigin("https://accounts.example.test:8443", { allowLoopbackHttp: false }),
    ).toBe("https://accounts.example.test:8443");
  });

  it("path・query・fragment・userinfo・HTTPを含む値を拒否する", () => {
    for (const invalid of [
      "not a url",
      "http://accounts.example.test",
      "https://accounts.example.test/api",
      "https://accounts.example.test/?a=1",
      "https://accounts.example.test/#top",
      "https://user:pass@accounts.example.test",
      "ftp://accounts.example.test",
    ]) {
      expect(parseAccountsOrigin(invalid, { allowLoopbackHttp: false })).toBeNull();
    }
  });

  it("loopbackのHTTPは許可された場合だけ受け付ける", () => {
    expect(parseAccountsOrigin("http://localhost:5173", { allowLoopbackHttp: true })).toBe(
      "http://localhost:5173",
    );
    expect(parseAccountsOrigin("http://127.0.0.1:5173", { allowLoopbackHttp: true })).toBe(
      "http://127.0.0.1:5173",
    );
    expect(parseAccountsOrigin("http://localhost:5173", { allowLoopbackHttp: false })).toBeNull();
    expect(
      parseAccountsOrigin("http://accounts.example.test", { allowLoopbackHttp: true }),
    ).toBeNull();
  });
});

describe("toAccountsResourceIdentifier", () => {
  it("資源APIの識別子は`{origin}/api/v1`に固定する", () => {
    expect(toAccountsResourceIdentifier("https://accounts.example.test")).toBe(
      "https://accounts.example.test/api/v1",
    );
  });
});
