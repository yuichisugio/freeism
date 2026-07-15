export const ja = {
  auctions: "Auction一覧",
  bids: "入札履歴",
  connectionUnavailable: "現在この連携情報を取得できません。時間をおいて再度お試しください。",
  created: "出品したAuction",
  docs: "ドキュメント",
  importAuctions: "CSVからAuctionを作成",
  language: "表示言語",
  loading: "読み込み中…",
  login: "ログイン",
  loginWithGoogle: "Googleでログイン",
  pointsConnection: "Points連携",
  privacy: "プライバシー",
  retry: "再読み込み",
  serviceName: "Freeism Markets",
  terms: "利用規約",
  won: "落札履歴",
} as const;

export type MarketsMessageKey = keyof typeof ja;
