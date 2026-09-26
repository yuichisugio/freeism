import { describe, expect, it } from "vitest";

import { findClientsLackingVerifiedSelection } from "./find-clients-lacking-verified-selection";

const verifiedAccountIds = new Set(["verified-1", "verified-2"]);

describe("findClientsLackingVerifiedSelection", () => {
  it("同意ONで証明済みの外部アカウントを1件も選択していないクライアントの位置を返す", () => {
    const clients = [
      { consented: true, visibleAccountIds: ["verified-1"] },
      { consented: true, visibleAccountIds: [] },
      { consented: true, visibleAccountIds: ["candidate-1"] },
      { consented: true, visibleAccountIds: ["candidate-1", "verified-2"] },
    ];

    expect(findClientsLackingVerifiedSelection(clients, verifiedAccountIds)).toEqual([1, 2]);
  });

  it("同意OFFのクライアントは選択が無くても保存できる", () => {
    const clients = [
      { consented: false, visibleAccountIds: [] },
      { consented: false, visibleAccountIds: ["candidate-1"] },
    ];

    expect(findClientsLackingVerifiedSelection(clients, verifiedAccountIds)).toEqual([]);
  });
});
