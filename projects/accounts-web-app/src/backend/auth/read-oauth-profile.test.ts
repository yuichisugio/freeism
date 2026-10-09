import { describe, expect, it } from "vitest";

import { toOAuthProfile } from "./read-oauth-profile";

describe("toOAuthProfile", () => {
  it("GoogleはID Tokenの表示名とメールアドレスを使う", () => {
    expect(
      toOAuthProfile("google", "1234", {
        user: { name: "Alice", email: "alice@example.com" },
        data: { sub: "1234", name: "Alice", email: "alice@example.com" },
      }),
    ).toEqual({
      identity: { providerId: "google", accountId: "1234", username: null },
      displayName: "Alice",
      email: "alice@example.com",
    });
  });

  it("GitHubは/userのloginをユーザー名にし、標準の取得結果の表示名・メールアドレスを使う", () => {
    expect(
      toOAuthProfile("github", "42", {
        user: { name: "Alice Dev", email: "primary@example.com" },
        data: { id: 42, login: "Alice-Dev", name: "Alice Dev", email: null },
      }),
    ).toEqual({
      identity: { providerId: "github", accountId: "42", username: "Alice-Dev" },
      displayName: "Alice Dev",
      email: "primary@example.com",
    });
  });

  it("ORCIDはuserinfoのnameを表示名にし、内部用のメールアドレスは保存しない", () => {
    expect(
      toOAuthProfile("orcid", "0000-0002-1825-0097", {
        user: { name: "Josiah Carberry", email: "0000-0002-1825-0097@orcid.invalid" },
        data: { sub: "0000-0002-1825-0097", name: "Josiah Carberry" },
      }),
    ).toEqual({
      identity: { providerId: "orcid", accountId: "0000-0002-1825-0097", username: null },
      displayName: "Josiah Carberry",
      email: null,
    });
  });

  it("ORCIDでnameが無い場合はgiven_nameとfamily_nameを表示名にする", () => {
    expect(
      toOAuthProfile("orcid", "0000-0002-1825-0097", {
        user: {},
        data: { sub: "0000-0002-1825-0097", given_name: "Josiah", family_name: "Carberry" },
      }).displayName,
    ).toBe("Josiah Carberry");
  });

  it("表示名・メールアドレスを取得できない場合はnullにする", () => {
    expect(
      toOAuthProfile("orcid", "0000-0002-1825-0097", { user: {}, data: {} }).displayName,
    ).toBeNull();
    expect(toOAuthProfile("google", "1234", { user: {}, data: {} })).toMatchObject({
      displayName: null,
      email: null,
    });
  });
});
