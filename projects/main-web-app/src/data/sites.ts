export type FreeismSite = {
  readonly url: `https://${string}`;
  readonly label: string;
  readonly responsibility: string;
};

export const FREEISM_SITES = [
  {
    url: "https://docs.freeism.app/",
    label: "ドキュメント",
    responsibility: "無料主義v3の日英仕様書、ノート、全文検索。",
  },
  {
    url: "https://points.freeism.app/",
    label: "Points",
    responsibility: "評価軸、ポイント付与、残高管理。",
  },
  {
    url: "https://markets.freeism.app/",
    label: "Markets",
    responsibility: "商材情報を含むAuction。",
  },
] as const satisfies readonly FreeismSite[];
