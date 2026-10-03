import { describe, expect, it } from "vite-plus/test";

import { fixCsvSchema, readRecipientIdentifier } from "./validate-fix-csv";

describe("FIX CSV の列", () => {
  it("受領者の識別子2列を固定順で持つ", () => {
    expect(fixCsvSchema.columns.map(({ name }) => name)).toEqual([
      "fixResultId",
      "expectedRevision",
      "recipientProfileUrl",
      "recipientAccountsUserId",
      "evaluationCriterionId",
      "amount",
      "evaluationAt",
      "managementId",
      "memo",
    ]);
  });
});

describe("readRecipientIdentifier", () => {
  it("プロフィールURLだけを指定した行はurl識別子にする", () => {
    expect(
      readRecipientIdentifier({
        recipientAccountsUserId: "",
        recipientProfileUrl: "https://example.com/alice",
      }),
    ).toEqual({ type: "url", value: "https://example.com/alice" });
  });

  it("AccountsユーザーIDだけを指定した行はaccounts_user識別子にする", () => {
    expect(
      readRecipientIdentifier({ recipientAccountsUserId: "ausr_alice", recipientProfileUrl: "" }),
    ).toEqual({ type: "accounts_user", value: "ausr_alice" });
  });

  it("どちらも空の行はRECIPIENT_IDENTIFIER_REQUIREDにする", () => {
    expect(readRecipientIdentifier({ recipientAccountsUserId: "", recipientProfileUrl: "" })).toBe(
      "RECIPIENT_IDENTIFIER_REQUIRED",
    );
  });

  it("両方を指定した行はRECIPIENT_IDENTIFIER_AMBIGUOUSにする", () => {
    expect(
      readRecipientIdentifier({
        recipientAccountsUserId: "ausr_alice",
        recipientProfileUrl: "https://example.com/alice",
      }),
    ).toBe("RECIPIENT_IDENTIFIER_AMBIGUOUS");
  });
});
