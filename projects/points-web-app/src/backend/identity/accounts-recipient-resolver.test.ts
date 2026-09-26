import { describe, expect, it } from "vite-plus/test";

import {
  createUnconfiguredAccountsRecipientResolver,
  recipientBusinessKey,
} from "./accounts-recipient-resolver";

describe("FIX recipient business key", () => {
  it("keeps the URL value as entered without normalization", () => {
    expect(
      recipientBusinessKey({ type: "url", value: "https://github.com/alice/" }, "https://a.test"),
    ).toBe("url:https://github.com/alice/");
  });

  it("scopes an Accounts user ID by the Accounts origin", () => {
    expect(
      recipientBusinessKey({ type: "accounts_user", value: "ausr_1" }, "https://a.test"),
    ).not.toBe(recipientBusinessKey({ type: "accounts_user", value: "ausr_1" }, "https://b.test"));
  });
});

describe("unconfigured Accounts recipient resolver", () => {
  it("rejects every resolution with ACCOUNTS_CONNECTION_REQUIRED", async () => {
    const resolve = createUnconfiguredAccountsRecipientResolver("acon_1");

    await expect(resolve([{ type: "url", value: "https://example.com/alice" }])).rejects.toThrow(
      "ACCOUNTS_CONNECTION_REQUIRED",
    );
  });
});
