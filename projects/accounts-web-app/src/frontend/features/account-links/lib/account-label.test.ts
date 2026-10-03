import { describe, expect, it } from "vitest";

import { createLinkedAccount } from "./account-links-fixtures";
import { describeAccount } from "./account-label";

describe("describeAccount", () => {
  it("識別子はユーザー名を優先し、OAuth Providerの行はURLがあってもProviderのアイコンにする", () => {
    const account = createLinkedAccount({
      service: "github",
      email: "alice@example.com",
      identifiers: [
        { id: "eid_1", type: "provider_account", provider: "github", value: "1843221", isActive: true },
        { id: "eid_2", type: "url", provider: null, value: "https://github.com/alice", isActive: true },
        { id: "eid_3", type: "provider_username", provider: "github", value: "alice", isActive: true },
      ],
    });

    expect(describeAccount(account)).toEqual({
      serviceName: "GitHub",
      identifier: "alice",
      icon: { type: "provider", provider: "github" },
    });
  });

  it("ユーザー名が無ければ、スキームと末尾の/を除いたURLを識別子にし、URLのホストのファビコンをアイコンにする", () => {
    const account = createLinkedAccount({
      service: null,
      identifiers: [{ id: "eid_1", type: "url", provider: null, value: "https://hanako.dev/", isActive: true }],
    });

    expect(describeAccount(account)).toEqual({
      serviceName: "Web",
      identifier: "hanako.dev",
      icon: { type: "favicon", host: "hanako.dev" },
    });
  });

  it("OAuth Providerでないサービスの行は、URLのホストのファビコンをアイコンにする", () => {
    const account = createLinkedAccount({
      service: "gitlab",
      identifiers: [{ id: "eid_1", type: "url", provider: null, value: "https://gitlab.com/hanako", isActive: true }],
    });

    expect(describeAccount(account).icon).toEqual({ type: "favicon", host: "gitlab.com" });
  });

  it("URLも無ければメールアドレス、メールアドレスも無ければ固有IDを識別子にする", () => {
    const providerAccount = { id: "eid_1", type: "provider_account", provider: "orcid", value: "0000-0002", isActive: true } as const;

    expect(
      describeAccount(createLinkedAccount({ service: "orcid", email: "hanako@example.com", identifiers: [providerAccount] })),
    ).toEqual({ serviceName: "ORCID", identifier: "hanako@example.com", icon: { type: "provider", provider: "orcid" } });
    expect(describeAccount(createLinkedAccount({ service: "orcid", email: null, identifiers: [providerAccount] })).identifier).toBe(
      "0000-0002",
    );
  });
});
