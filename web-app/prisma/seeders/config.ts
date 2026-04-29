import { faker } from "@faker-js/faker/locale/ja";

// 保持する固定ユーザーID (外部からアクセス可能にする)
export const PRESERVED_USER_IDS = ["cmceeh5c80004mcl28r6rwyv0", "cmarmneqq0000g5dyo5md5f84"];

export const SEED_CONFIG = {
  // 基本設定
  USERS_COUNT: 10, // 生成するユーザー数
  GROUPS_COUNT: 5, // 生成するグループ数
  MIN_MEMBERS_PER_GROUP: 3, // グループごとの最小メンバー数
  MAX_MEMBERS_PER_GROUP: 4, // グループごとの最大メンバー数
  TASKS_COUNT: 51, // 生成するタスク総数
  TASK_CATEGORIES: ["食品", "コード", "本", "デザイン", "開発", "マーケティング", "ライティング", "事務作業", "その他"],

  // タスク関連設定
  TASK_CATEGORY_COUNT: 9, // タスクカテゴリ数
  TASK_REPORTER_MIN: 1, // タスク報告者の最小数
  TASK_REPORTER_MAX: 3, // タスク報告者の最大数
  TASK_EXECUTOR_MIN: 1, // タスク実行者の最小数
  TASK_EXECUTOR_MAX: 3, // タスク実行者の最大数
  TASK_INFO_PROBABILITY: 0.7, // タスクに情報が付与される確率
  TASK_IMAGE_URL_PROBABILITY: 0.3, // タスクに画像URLが付与される確率
  TASK_REFERENCE_PROBABILITY: 0.3, // タスクに参照URLが付与される確率
  TASK_EVALUATOR_PROBABILITY: 0.5, // タスクに評価者が設定される確率
  TASK_FIXED_SUBMITTER_PROBABILITY: 0.3, // タスクに固定提出者が設定される確率
  TASK_REWARD_PROBABILITY: 0.8, // タスクが報酬タイプになる確率
  TASK_COMPLETED_PROBABILITY: 0.3, // タスクが完了ステータスになる確率

  // 分析関連設定
  ANALYTICS_PER_COMPLETED_TASK_MIN: 1, // 完了タスクあたりの最小分析数
  ANALYTICS_PER_COMPLETED_TASK_MAX: 3, // 完了タスクあたりの最大分析数

  // 通知関連設定
  NOTIFICATIONS_PER_USER_MIN: 1, // ユーザーごとの最小通知数
  NOTIFICATIONS_PER_USER_MAX: 10, // ユーザーごとの最大通知数
  NOTIFICATION_EXPIRY_PROBABILITY: 0.3, // 通知に期限が設定される確率
  NOTIFICATION_READ_PROBABILITY: 0.6, // 通知が既読になる確率

  // オークション関連設定
  MIN_REWARD_TASKS_FOR_AUCTION: 15, // オークション生成に必要な最小報酬タスク数
  AUCTION_START_TIME_MIN_DAYS_AGO: -7, // オークション開始時間の最小過去日数
  AUCTION_START_TIME_MAX_DAYS_AGO: 7, // オークション開始時間の最大過去日数
  AUCTION_DURATION_MIN_DAYS: 1, // オークション期間の最小日数
  AUCTION_DURATION_MAX_DAYS: 7, // オークション期間の最大日数
  AUCTION_INITIAL_PRICE_MIN: 500, // オークション開始価格の最小値
  AUCTION_INITIAL_PRICE_MAX: 5000, // オークション開始価格の最大値
  AUCTION_HAS_BIDS_PROBABILITY: 0.8, // オークションに入札がある確率
  AUCTION_BID_INCREASE_MIN_PERCENT: 0.1, // 最高入札額の増加率（最小）
  AUCTION_BID_INCREASE_MAX_PERCENT: 0.5, // 最高入札額の増加率（最大）
  BIDS_PER_AUCTION_MIN: 0, // オークションあたりの最小入札数
  BIDS_PER_AUCTION_MAX: 10, // オークションあたりの最大入札数
  BID_INCREASE_MIN_PERCENT: 0.01, // 入札額の増加率（最小）
  BID_INCREASE_MAX_PERCENT: 0.1, // 入札額の増加率（最大）
  BID_IS_AUTOBID_PROBABILITY: 0.3, // 入札が自動入札である確率
  AUTOBIDS_PER_AUCTION_MIN: 0, // オークションあたりの最小自動入札設定数
  AUTOBIDS_PER_AUCTION_MAX: 3, // オークションあたりの最大自動入札設定数
  AUTOBID_MAX_INCREASE_MIN_PERCENT: 1.1, // 自動入札上限額の増加率（最小）
  AUTOBID_MAX_INCREASE_MAX_PERCENT: 2.0, // 自動入札上限額の増加率（最大、100%増）
  AUTOBID_INCREMENT_MIN: 10, // 自動入札単位の最小値
  AUTOBID_INCREMENT_MAX: 200, // 自動入札単位の最大値
  AUCTION_NOTIFICATIONS_PER_RELEVANT_AUCTION_MIN: 1, // 関連オークションあたりの最小通知数
  AUCTION_NOTIFICATIONS_PER_RELEVANT_AUCTION_MAX: 3, // 関連オークションあたりの最大通知数
  AUCTION_REVIEW_PROBABILITY: 0.8, // オークションにレビューが存在する確率
  AUCTION_SELLER_REVIEW_RATING_MIN: 3, // 売り手レビューの最小評価
  AUCTION_SELLER_REVIEW_RATING_MAX: 5, // 売り手レビューの最大評価
  AUCTION_BUYER_TO_SELLER_REVIEW_PROBABILITY: 0.9, // 買い手から売り手へのレビューが存在する確率
  AUCTION_BUYER_REVIEW_RATING_MIN: 2, // 買い手レビューの最小評価
  AUCTION_BUYER_REVIEW_RATING_MAX: 5, // 買い手レビューの最大評価
  AUCTION_PROOF_URL_PROBABILITY: 0.4, // レビューに完了証明URLが存在する確率
  MESSAGES_PER_CONVERSATION_MIN: 2, // 会話あたりの最小メッセージ往復数
  MESSAGES_PER_CONVERSATION_MAX: 4, // 会話あたりの最大メッセージ往復数
  WATCHLISTS_PER_AUCTION_MIN: 0, // オークションあたりの最小ウォッチリスト登録数
  WATCHLISTS_PER_AUCTION_MAX: 5, // オークションあたりの最大ウォッチリスト登録数

  // オークション延長関連設定
  AUCTION_EXTENSION_PROBABILITY: 0.3, // オークション延長機能を有効にする確率
  AUCTION_EXTENSION_OCCURRED_PROBABILITY: 0.6, // 延長機能が有効な場合に実際に延長が発生する確率
  AUCTION_EXTENSION_LIMIT_COUNT_MIN: 1, // 延長制限回数の最小値
  AUCTION_EXTENSION_LIMIT_COUNT_MAX: 5, // 延長制限回数の最大値
  AUCTION_EXTENSION_LIMIT_TIME_MIN: 5, // 延長制限時間の最小値（分）
  AUCTION_EXTENSION_LIMIT_TIME_MAX: 15, // 延長制限時間の最大値（分）

  // グループポイント関連設定
  GROUP_POINTS_INITIAL_MIN: 100, // 初期グループポイントの最小値
  GROUP_POINTS_INITIAL_MAX: 10000, // 初期グループポイントの最大値

  // ポイント返還関連設定
  POINT_RETURN_SIMULATION_PROBABILITY: 0.5, // ポイント返還シミュレーションが実行される確率

  // --- 保持ユーザー関連の確率設定 ---
  PRESERVED_USER_AS_GROUP_CREATOR_PROBABILITY: 1.0, // グループ作成者として保持ユーザーを常に使う (可能なら)
  PRESERVED_USER_JOIN_GROUP_PROBABILITY: 0.5, // グループメンバーになる確率
  PRESERVED_USER_CREATE_TASK_INITIAL_COUNT: PRESERVED_USER_IDS.length, // 最初のN個のタスクは保持ユーザーが作成
  PRESERVED_USER_CREATE_TASK_RANDOM_PROBABILITY: 0.3, // ランダムなタスク作成者として選ばれる確率
  PRESERVED_USER_AS_TASK_REPORTER_PROBABILITY: 0.4, // タスク報告者になる確率
  PRESERVED_USER_AS_TASK_EXECUTOR_PROBABILITY: 0.4, // タスク実行者になる確率
  PRESERVED_USER_AS_TASK_EVALUATOR_PROBABILITY: 0.2, // 固定評価者になる確率
  PRESERVED_USER_AS_TASK_SUBMITTER_PROBABILITY: 0.2, // 固定提出者になる確率
  PRESERVED_USER_AS_ANALYTICS_EVALUATOR_PROBABILITY: 0.3, // 分析評価者になる確率
  PRESERVED_USER_AS_NOTIFICATION_SENDER_PROBABILITY: 0.2, // 通知送信者になる確率
  PRESERVED_USER_AS_AUCTION_HIGHEST_BIDDER_PROBABILITY: 0.5, // 最高入札者になる確率
  PRESERVED_USER_AS_BIDDER_PROBABILITY: 0.4, // 入札者になる確率
  PRESERVED_USER_AS_AUTOBID_USER_PROBABILITY: 0.5, // 自動入札設定者になる確率
  PRESERVED_USER_AS_WATCHLIST_USER_PROBABILITY: 0.6, // ウォッチリスト登録者になる確率
  PRESERVED_USER_AS_MESSAGE_PARTNER_PROBABILITY: 0.5, // メッセージ相手になる確率
  // --- ここまで ---

  // その他
  VERIFICATION_TOKENS_COUNT: 10, // 生成する認証トークン数
};

// 乱数シードを設定
const randomSeed = Math.random();
faker.seed(randomSeed);

// 提供方法のリスト
export const DELIVERY_METHODS = [
  "Amazonのほしい物リスト",
  "GitHubスポンサー",
  "直接発送（着払い）",
  "オンラインコード送信",
  "オンラインミーティング",
  "チャットでの情報提供",
  "メールでのデータ送信",
];

// カテゴリ別の提供方法マッピング
export const CATEGORY_DELIVERY_METHODS: Record<string, string[]> = {
  食品: ["直接配送", "宅配便", "フードデリバリー", "お取り寄せ"],
  コード: ["GitHub", "GitLab", "BitBucket", "メール添付"],
  本: ["郵送", "電子書籍", "PDF送信", "オンライン閲覧"],
  デザイン: ["Figmaリンク", "Dropbox", "Google Drive", "メール添付"],
  開発: ["リポジトリ共有", "API連携", "Docker Hub", "開発環境共有"],
  マーケティング: ["レポート共有", "分析データ送付", "プレゼン資料", "ビデオ会議"],
  ライティング: ["Google Docs", "Word文書", "PDF送信", "ブログ投稿"],
  事務作業: ["メール", "Slack", "共有ドキュメント", "ビデオ会議"],
  その他: ["メール", "郵送", "オンライン共有", "直接対面"],
};

console.log("乱数シードを設定しました。シード値: ", randomSeed);
