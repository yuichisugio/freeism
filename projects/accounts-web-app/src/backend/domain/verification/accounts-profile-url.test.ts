import { describe, expect, it } from "vitest";

import { buildAccountsProfileUrl } from "./accounts-profile-url";

describe("buildAccountsProfileUrl", () => {
  it("公開originとAccountsユーザーIDから公開プロフィールURLを作る", () => {
    expect(
      buildAccountsProfileUrl({
        accountsOrigin: "https://accounts.freeism.app",
        accountsUserId: "ausr_alice",
      }),
    ).toBe("https://accounts.freeism.app/profiles/ausr_alice");
  });

  it("originに付いた末尾slashを重ねない", () => {
    expect(
      buildAccountsProfileUrl({
        accountsOrigin: "https://accounts.freeism.app/",
        accountsUserId: "ausr_alice",
      }),
    ).toBe("https://accounts.freeism.app/profiles/ausr_alice");
  });
});
