import { describe, expect, it } from "vitest";

import { createAccountLinks, createLinkedAccount, createLinkedClient } from "./account-links-fixtures";
import { buildVisibilityInput, buildVisibilityTable, emptyVisibilityEdits, setSelection } from "./visibility-draft";
import type { Destination } from "./visibility-draft";

const points = createLinkedClient({ clientId: "points", name: "Points" });
const other = createLinkedClient({ clientId: "other", name: "Other" });
const profile: Destination = { kind: "profile" };
const pointsColumn: Destination = { kind: "client", client: points };
const otherColumn: Destination = { kind: "client", client: other };

const verifiedAccount = createLinkedAccount({ id: "eac_verified", isPublic: true, visibility: { points: false } });
const unverifiedAccount = createLinkedAccount({ id: "eac_unverified", verificationStatus: "unverified" });
const links = createAccountLinks({ accounts: [verifiedAccount, unverifiedAccount], clients: [points, other] });

describe("buildVisibilityTable", () => {
  it("プロフィールの列を先頭に、各クライアントの列を続け、保存済みの選択をセルに示す", () => {
    const table = buildVisibilityTable(links, emptyVisibilityEdits);

    expect(table.columns.map((column) => column.destination)).toEqual([profile, pointsColumn, otherColumn]);
    expect(table.rows.map((row) => row.cells.map((cell) => cell.isSelected))).toEqual([
      [true, false, false],
      [false, false, false],
    ]);
    expect(table.changeCount).toBe(0);
  });

  it("保存済みの値から変わったセルだけを変更として数える", () => {
    let edits = setSelection(emptyVisibilityEdits, [profile, pointsColumn], ["eac_verified"], true);
    edits = setSelection(edits, [otherColumn], ["eac_unverified"], true);

    const table = buildVisibilityTable(links, edits);

    expect(table.rows.map((row) => row.cells.map((cell) => cell.isChanged))).toEqual([
      [false, true, false],
      [false, false, true],
    ]);
    expect(table.changeCount).toBe(2);
  });

  it("保存済みと同じ値へ戻した場合は変更とみなさない", () => {
    const edits = setSelection(setSelection(emptyVisibilityEdits, [profile], ["eac_verified"], false), [profile], ["eac_verified"], true);

    expect(buildVisibilityTable(links, edits).changeCount).toBe(0);
  });

  it("一覧に無くなった行の編集は変更とみなさない", () => {
    expect(buildVisibilityTable(links, setSelection(emptyVisibilityEdits, [profile], ["eac_removed"], true)).changeCount).toBe(0);
  });

  it("「公開中」は、保存済みの状態で証明済みの行の選択があるかで判定し、編集中の選択には左右されない", () => {
    // 未検証の行だけを選んだ列は公開中にならない。
    const saved = createAccountLinks({
      accounts: [
        createLinkedAccount({ id: "eac_verified", isPublic: false, visibility: { points: true } }),
        createLinkedAccount({ id: "eac_unverified", verificationStatus: "unverified", isPublic: true, visibility: {} }),
      ],
      clients: [points, other],
    });
    const edits = setSelection(emptyVisibilityEdits, [otherColumn], ["eac_verified"], true);

    const table = buildVisibilityTable(saved, edits);

    expect(table.columns.map((column) => column.isPublished)).toEqual([false, true, false]);
  });
});

describe("buildVisibilityInput", () => {
  it("一般公開とクライアント別の公開選択をまとめ、未検証の行の選択も送る", () => {
    const edits = setSelection(emptyVisibilityEdits, [profile, pointsColumn], ["eac_verified", "eac_unverified"], true);

    expect(buildVisibilityInput(links, edits)).toEqual({
      accounts: [
        { externalAccountId: "eac_verified", isPublic: true },
        { externalAccountId: "eac_unverified", isPublic: true },
      ],
      clients: [
        { clientId: "points", visibleAccountIds: ["eac_verified", "eac_unverified"] },
        { clientId: "other", visibleAccountIds: [] },
      ],
    });
  });
});
