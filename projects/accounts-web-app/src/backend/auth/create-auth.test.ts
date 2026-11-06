import { describe, expect, it } from "vitest";

import { generateAuthId, mapOrcidProfileToUser, parseAuthSecrets } from "./create-auth";

describe("generateAuthId", () => {
  it("userはausr_に128bitのURL-safe乱数を付けたIDにする", () => {
    expect(generateAuthId({ model: "user" })).toMatch(/^ausr_[A-Za-z0-9_-]{22}$/);
  });

  it("user以外はBetter Auth既定と同じ32文字の英数字にする", () => {
    expect(generateAuthId({ model: "account" })).toMatch(/^[A-Za-z0-9]{32}$/);
    expect(generateAuthId({ model: "oauthClient" })).toMatch(/^[A-Za-z0-9]{32}$/);
  });

  it("sizeの指定があればuser以外はその長さにする", () => {
    expect(generateAuthId({ model: "session", size: 40 })).toMatch(/^[A-Za-z0-9]{40}$/);
  });
});

describe("mapOrcidProfileToUser", () => {
  it("ORCID iDから内部用のメールアドレスを作り、未確認として渡す", () => {
    expect(mapOrcidProfileToUser({ sub: "0000-0002-1825-0097", name: "Josiah Carberry" })).toEqual({
      email: "0000-0002-1825-0097@orcid.invalid",
      emailVerified: false,
    });
  });
});

describe("parseAuthSecrets", () => {
  it("`version:value`のカンマ区切りを先頭がcurrentの配列にする", () => {
    expect(parseAuthSecrets("2:new-secret,1:old-secret")).toEqual([
      { version: 2, value: "new-secret" },
      { version: 1, value: "old-secret" },
    ]);
  });

  it("Secretの前後の空白・改行を除く", () => {
    expect(parseAuthSecrets(" 2:new-secret , 1:old-secret\n")).toEqual([
      { version: 2, value: "new-secret" },
      { version: 1, value: "old-secret" },
    ]);
  });
});
