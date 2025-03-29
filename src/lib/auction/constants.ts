// オークション関連の定数を定義

// SSEの設定パラメータ
export const HEARTBEAT_INTERVAL = 30000; // 30秒（ハートビート間隔）
export const HEARTBEAT_TIMEOUT = 45000; // 45秒（ハートビートタイムアウト）
export const CONNECTION_TIMEOUT = 10000; // 10秒（接続タイムアウト）
export const BUFFER_INTERVAL = 1000; // バッファ処理間隔（ミリ秒）

// リトライ戦略の設定（指数バックオフ + ジッター）
export const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]; // 最大30秒

// 自動入札の最小間隔（分）
export const AUTO_BID_MIN_INTERVAL_MINUTES = 10;

// オークション終了時間の延長
export const AUCTION_END_EXTENSION = {
  // 終了時間の延長が発生する残り時間（分）
  THRESHOLD_MINUTES: 5,
  // 最小延長時間（分）
  MIN_EXTENSION_MINUTES: 1,
  // 最大延長時間（オークション期間のx%）
  MAX_EXTENSION_PERCENT: 0.05,
  // 最大延長回数
  MAX_EXTENSION_COUNT: 2,
};

// SSEからの更新を確認するためのポーリング間隔を30秒に設定（1秒未満にしない）
export const POLLING_INTERVAL = 30000;

// オークションSSEの最大リトライ回数
export const MAX_RETRIES = 5;

// オークション画像のデフォルトURL
export const DEFAULT_AUCTION_IMAGE_URL = "/images/default-auction.svg";

// カテゴリ
export const AUCTION_CATEGORIES = ["すべて", "食品", "コード", "本", "etc"];

// 表示関連
export const DISPLAY = {
  // 入札履歴の表示件数
  BID_HISTORY_LIMIT: 20,
  // 質問と回答の表示件数
  QA_LIMIT: 10,
  // 表示件数
  PAGE_SIZE: 50,
};

// タブの定義
export const AUCTION_DETAIL_TABS = {
  DETAILS: "詳細",
  BID_HISTORY: "入札履歴",
  QA: "質問と回答",
  SHIPPING: "配送・支払い",
  OTHER: "その他",
} as const;

// オークションステータスの表示名
export const AUCTION_STATUS_DISPLAY = {
  PENDING: "出品待ち",
  ACTIVE: "出品中",
  ENDED: "終了",
  CANCELED: "キャンセル",
} as const;

// 入札タイプの表示名
export const BID_TYPE_DISPLAY = {
  MANUAL: "通常入札",
  AUTO: "自動入札",
} as const;
