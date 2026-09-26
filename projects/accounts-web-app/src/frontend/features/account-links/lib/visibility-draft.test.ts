import { describe, expect, it } from "vitest";

import { createAccountLinks, createLinkedAccount, createLinkedClient } from "./account-links-fixtures";
import {
  buildVisibilityInput,
  buildVisibilityTable,
  emptyVisibilityEdits,
  isVisibilityDirty,
  setAccountPublic,
  setClientConsent,
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
        clients: [createLinkedClient({ consented: true })],
      }),
      emptyVisibilityEdits,
    );

    expect(table.rows[0]).toMatchObject({ isPublic: true, visibleClientIds: ["points"] });
    expect(table.columns[0]).toMatchObject({ consented: true, lacksVerifiedSelection: false });
  });

  it("同意ONで証明済みの選択が0件のクライアントを示す", () => {
    const edits = setClientVisibility(setClientConsent(emptyVisibilityEdits, "points", true), "points", ["eac_unverified"], true);

    const table = buildVisibilityTable(links, edits);

    expect(table.columns.map((column) => [column.client.clientId, column.lacksVerifiedSelection])).toEqual([
      ["points", true],
      ["other", false],
    ]);
    expect(table.canSave).toBe(false);
  });

  it("同意ONで証明済みの選択があれば保存できる", () => {
    const edits = setClientVisibility(setClientConsent(emptyVisibilityEdits, "points", true), "points", ["eac_verified"], true);

    expect(buildVisibilityTable(links, edits).canSave).toBe(true);
  });

  it("未変更の場合は保存できない", () => {
    expect(buildVisibilityTable(links, emptyVisibilityEdits).canSave).toBe(false);
  });

  it("同意を強制した連携先について、証明済みの選択が無ければ示す", () => {
    const table = buildVisibilityTable(links, emptyVisibilityEdits, "other");

    expect(table.columns.find((column) => column.client.clientId === "other")?.lacksVerifiedSelection).toBe(true);
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
  it("一般公開・同意・クライアント別の公開選択をまとめる", () => {
    let edits = setAccountPublic(emptyVisibilityEdits, "eac_unverified", true);
    edits = setClientConsent(edits, "points", true);
    edits = setClientVisibility(edits, "points", ["eac_verified", "eac_unverified"], true);

    expect(buildVisibilityInput(links, edits)).toEqual({
      accounts: [
        { externalAccountId: "eac_verified", isPublic: false },
        { externalAccountId: "eac_unverified", isPublic: true },
      ],
      clients: [
        { clientId: "points", consented: true, visibleAccountIds: ["eac_verified", "eac_unverified"] },
        { clientId: "other", consented: false, visibleAccountIds: [] },
      ],
    });
  });

  it("同意を強制した連携先は同意ONで送る", () => {
    expect(buildVisibilityInput(links, emptyVisibilityEdits, "other").clients[1]).toMatchObject({
      clientId: "other",
      consented: true,
    });
  });
});
