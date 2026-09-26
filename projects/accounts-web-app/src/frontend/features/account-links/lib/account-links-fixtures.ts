import type { AccountLinks, LinkedAccount, LinkedClient } from "../../../../shared/schemas/account-link-schema";

/**
 * テスト用の外部アカウント1行を作る。
 */
export function createLinkedAccount(overrides: Partial<LinkedAccount> = {}): LinkedAccount {
  return {
    id: "eac_1",
    service: "github",
    displayName: "Alice",
    email: null,
    linkedAt: "2026-09-01T00:00:00Z",
    isPublic: false,
    verificationStatus: "verified",
    identifiers: [{ id: "eid_1", type: "url", provider: null, value: "https://github.com/alice", isActive: true }],
    verifications: [],
    visibility: {},
    hasImportedVerifications: false,
    ...overrides,
  };
}

/**
 * テスト用のOAuthクライアント1件を作る。
 */
export function createLinkedClient(overrides: Partial<LinkedClient> = {}): LinkedClient {
  return {
    clientId: "points",
    name: "Points",
    uri: "https://points.example/",
    consented: false,
    isConsentRequest: false,
    ...overrides,
  };
}

/**
 * テスト用の一覧を作る。
 */
export function createAccountLinks(overrides: Partial<AccountLinks> = {}): AccountLinks {
  return {
    profileUrl: "https://accounts.example/profiles/ausr_1",
    accounts: [createLinkedAccount()],
    clients: [createLinkedClient()],
    ...overrides,
  };
}
