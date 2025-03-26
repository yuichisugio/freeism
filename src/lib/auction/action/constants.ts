// SSE設定パラメータ
export const SSE_CONFIG = {
  MAX_CONNECTIONS_PER_AUCTION: 1000, // オークションごとの最大接続数
  CONNECTION_TIMEOUT: 60 * 60 * 1000, // 60分タイムアウト
  HEARTBEAT_INTERVAL: 30000, // 30秒ごとにハートビート
  MAX_EVENT_HISTORY: 50, // オークションごとのイベント履歴最大数
};

// 表示設定
export const DISPLAY = {
  PAGE_SIZE: 12,
};

// オークションのデフォルトイメージURL
export const DEFAULT_AUCTION_IMAGE_URL = "/images/default-auction-image.jpg";

// オークションカテゴリ
export const AUCTION_CATEGORIES = ["すべて", "デザイン", "開発", "マーケティング", "ライティング", "事務作業", "その他"];
