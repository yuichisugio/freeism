// オークション関連の定数を定義

// SSE設定パラメータ
export const SSE_CONFIG = {
  MAX_CONNECTIONS_PER_AUCTION: 1000, // オークションごとの最大接続数
  CONNECTION_TIMEOUT: 60 * 60 * 1000, // 60分タイムアウト
  HEARTBEAT_INTERVAL: 30000, // 30秒ごとにハートビート
  MAX_EVENT_HISTORY: 50, // オークションごとのイベント履歴最大数
  HEARTBEAT_TIMEOUT: 45000, // 45秒（ハートビートタイムアウト）
  BUFFER_INTERVAL: 1000, // バッファ処理間隔（ミリ秒）
  RETRY_DELAYS: [1000, 2000, 5000, 10000, 30000], // リトライ戦略の設定（指数バックオフ + ジッター）
  MAX_RETRIES: 5, // オークションSSEの最大リトライ回数
};

// オークションの定数
export const AUCTION_CONSTANTS = {
  // オークションのデフォルトイメージURL
  DEFAULT_AUCTION_IMAGE_URL: "/images/default-auction-image.jpg",

  // オークションカテゴリ
  AUCTION_CATEGORIES: ["すべて", "食品", "コード", "本", "デザイン", "開発", "マーケティング", "ライティング", "事務作業", "その他"],

  // 自動入札の最小間隔（分）
  AUTO_BID_MIN_INTERVAL_MINUTES: 10,

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

  // 表示関連
  DISPLAY: {
    // 入札履歴の表示件数
    BID_HISTORY_LIMIT: 20,
    // 質問と回答の表示件数
    QA_LIMIT: 10,
    // 表示件数
    PAGE_SIZE: 50,
  },
};
