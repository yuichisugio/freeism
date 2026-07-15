import { describe, expect, it } from "vitest";

import { FREEISM_SITES } from "./sites";

describe("FREEISM_SITES", () => {
  it("exposes the three independent Freeism destinations over HTTPS", () => {
    expect(FREEISM_SITES.map(({ url }) => url)).toEqual([
      "https://docs.freeism.app/",
      "https://points.freeism.app/",
      "https://markets.freeism.app/",
    ]);
  });

  it("describes each destination with its public responsibility", () => {
    expect(
      FREEISM_SITES.map(({ label, responsibility }) => ({ label, responsibility })),
    ).toEqual([
      {
        label: "ドキュメント",
        responsibility: "無料主義v3の日英仕様書、ノート、全文検索。",
      },
      {
        label: "Points",
        responsibility: "評価軸、ポイント付与、残高管理。",
      },
      {
        label: "Markets",
        responsibility: "商材情報を含むAuction。",
      },
    ]);
  });
});
