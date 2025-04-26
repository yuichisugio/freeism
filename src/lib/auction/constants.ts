// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知関連の定数
 */
export const NOTIFICATION_CONSTANTS = {
  ITEMS_PER_PAGE: 20,
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * SSE設定パラメータ
 */
export const SSE_CONFIG = {
  HEARTBEAT_INTERVAL: 20 * 1000, // 20秒ごとにハートビート
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション表示関連の定数
 */
export const AUCTION_DISPLAY = {
  // 入札履歴の表示件数
  BID_HISTORY_LIMIT: 25,
  // 質問と回答の表示件数
  QA_LIMIT: 10,
  // 表示件数
  PAGE_SIZE: 20,
};

/**
 * オークション情報を更新するためのselect
 */
export const AUCTION_UPDATE_SELECT = {
  id: true,
  currentHighestBid: true,
  currentHighestBidderId: true,
  status: true,
  extensionTotalCount: true,
  extensionLimitCount: true,
  extensionTotalTime: true,
  extensionLimitTime: true,
  bidHistories: {
    orderBy: { createdAt: "desc" as const },
    take: AUCTION_DISPLAY.BID_HISTORY_LIMIT + 1, // 1件多く取得して、２５＋１にしたい
    select: {
      id: true,
      amount: true,
      createdAt: true,
      isAutoBid: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  },
};

export const AUCTION_CONSTANTS = {
  // 表示関連
  DISPLAY: AUCTION_DISPLAY,
  // オークション情報を更新するためのselect
  UPDATE_AUCTION_SELECT: AUCTION_UPDATE_SELECT,
  // オークションのデフォルトイメージURL
  DEFAULT_AUCTION_IMAGE_URL: "/images/default-auction-image.png",

  // オークションカテゴリ
  AUCTION_CATEGORIES: ["すべて", "食品", "コード", "本", "デザイン", "開発", "マーケティング", "ライティング", "事務作業", "その他"],

  // 自動入札の最小間隔（分）
  AUTO_BID_MIN_INTERVAL_MINUTES: 10,

  // 自動入札の最小間隔（ミリ秒）
  AUTO_BID_MIN_INTERVAL_MS: 1 * 60 * 1000, //1秒

  // オークション終了時間の延長
  AUCTION_END_EXTENSION: {
    // 終了時間の延長が発生する残り時間（分）
    THRESHOLD_MINUTES: 5,
    // 最小延長時間（分）
    MIN_EXTENSION_MINUTES: 1,
    // 最大延長時間（オークション期間のx%）
    MAX_EXTENSION_PERCENT: 0.05,
    // 最大延長回数
    MAX_EXTENSION_COUNT: 2,
  },
};
