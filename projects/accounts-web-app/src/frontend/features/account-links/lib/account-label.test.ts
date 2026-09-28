import { describe, expect, it } from "vitest";

import { createLinkedAccount } from "./account-links-fixtures";
import { describeAccount } from "./account-label";

describe("describeAccount", () => {
  it("識別子はユーザー名を優先する", () => {
    const account = createLinkedAccount({
      service: "github",
      email: "alice@example.com",
      identifiers: [
        { id: "eid_1", type: "provider_account", provider: "github", value: "1843221", isActive: true },
        { id: "eid_2", type: "url", provider: null, value: "https://github.com/alice", isActive: true },
        { id: "eid_3", type: "provider_username", provider: "github", value: "alice", isActive: true },
      ],
    });

    expect(describeAccount(account)).toEqual({ serviceName: "GitHub", identifier: "alice", iconHost: "github.com" });
  });

  it("ユーザー名が無ければ、スキームと末尾の/を除いたURLを識別子にし、URLのホストをアイコンに使う", () => {
    const account = createLinkedAccount({
      service: null,
      identifiers: [{ id: "eid_1", type: "url", provider: null, value: "https://hanako.dev/", isActive: true }],
    });

    expect(describeAccount(account)).toEqual({ serviceName: "Web", identifier: "hanako.dev", iconHost: "hanako.dev" });
  });

  it("URLも無ければメールアドレス、メールアドレスも無ければ固有IDを識別子にする", () => {
    const providerAccount = { id: "eid_1", type: "provider_account", provider: "google", value: "10383", isActive: true } as const;

    expect(
      describeAccount(createLinkedAccount({ service: "google", email: "hanako@example.com", identifiers: [providerAccount] })),
    ).toEqual({ serviceName: "Google", identifier: "hanako@example.com", iconHost: "google.com" });
    expect(describeAccount(createLinkedAccount({ service: "google", email: null, identifiers: [providerAccount] })).identifier).toBe(
      "10383",
    );
  });
});
