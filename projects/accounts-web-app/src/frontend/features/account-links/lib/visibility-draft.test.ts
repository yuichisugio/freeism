import { describe, expect, it } from "vitest";

import { createAccountLinks, createLinkedAccount, createLinkedClient } from "./account-links-fixtures";
import {
  buildVisibilityInput,
  buildVisibilityTable,
  emptyVisibilityEdits,
  isVisibilityDirty,
  setAccountPublic,
  setClientVisibility,
} from "./visibility-draft";

const verifiedAccount = createLinkedAccount({ id: "eac_verified", visibility: { points: false } });
const unverifiedAccount = createLinkedAccount({ id: "eac_unverified", verificationStatus: "unverified" });
const links = createAccountLinks({
  accounts: [verifiedAccount, unverifiedAccount],
  clients: [createLinkedClient({ clientId: "points" }), createLinkedClient({ clientId: "other", name: "Other" })],
});

describe("buildVisibilityTable", () => {
  it("編集が無ければ保存済みの値を表示する", () => {
    const table = buildVisibilityTable(
      createAccountLinks({
        accounts: [createLinkedAccount({ isPublic: true, visibility: { points: true } })],
        clients: [createLinkedClient()],
      }),
      emptyVisibilityEdits,
    );

    expect(table.rows[0]).toMatchObject({ isPublic: true, visibleClientIds: ["points"] });
    expect(table.columns[0]).toMatchObject({ hasVerifiedSelection: true });
  });

  it("証明済みの外部アカウントを公開選択した連携先だけを、証明済みの選択ありとして示す", () => {
    const edits = setClientVisibility(emptyVisibilityEdits, "points", ["eac_unverified"], true);

    const table = buildVisibilityTable(links, setClientVisibility(edits, "other", ["eac_verified"], true));

    expect(table.columns.map((column) => [column.client.clientId, column.hasVerifiedSelection])).toEqual([
      ["points", false],
      ["other", true],
    ]);
  });
});

describe("isVisibilityDirty", () => {
  it("保存済みと同じ値へ戻した場合は未変更とみなす", () => {
    const edits = setAccountPublic(setAccountPublic(emptyVisibilityEdits, "eac_verified", true), "eac_verified", false);

    expect(isVisibilityDirty(links, edits)).toBe(false);
  });

  it("一覧に無くなった行の編集は変更とみなさない", () => {
    expect(isVisibilityDirty(links, setAccountPublic(emptyVisibilityEdits, "eac_removed", true))).toBe(false);
  });
});

describe("buildVisibilityInput", () => {
  it("一般公開とクライアント別の公開選択をまとめ、未検証の行の選択も送る", () => {
    let edits = setAccountPublic(emptyVisibilityEdits, "eac_unverified", true);
    edits = setClientVisibility(edits, "points", ["eac_verified", "eac_unverified"], true);

    expect(buildVisibilityInput(links, edits)).toEqual({
      accounts: [
        { externalAccountId: "eac_verified", isPublic: false },
        { externalAccountId: "eac_unverified", isPublic: true },
      ],
      clients: [
        { clientId: "points", visibleAccountIds: ["eac_verified", "eac_unverified"] },
        { clientId: "other", visibleAccountIds: [] },
      ],
    });
  });
});
