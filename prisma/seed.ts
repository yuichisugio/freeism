import type { BidHistory, NotificationSendMethod, NotificationSendTiming } from "@prisma/client";
import type { JsonValue } from "@prisma/client/runtime/library";
import { faker } from "@faker-js/faker/locale/ja";
import { AuctionEventType, AuctionStatus, BidStatus, NotificationTargetType, Prisma, PrismaClient, ReviewPosition, TaskStatus } from "@prisma/client";

/**
 * データ生成設定
 * 各エンティティの生成数を集中管理するための設定オブジェクト
 *
 * 【依存関係の注意点】
 * - アカウント、セッション、ユーザー設定: ユーザー数に依存
 * - グループメンバーシップ: グループ数と各グループのメンバー数（最小・最大）に依存
 * - タスク: グループメンバーシップに依存
 *
 * 設定変更時は相互依存関係に注意してください。
 */
// 保持する固定ユーザーID (外部からアクセス可能にする)
const PRESERVED_USER_IDS = ["cmas8p75j0000g5qe2bee95b6", "cmarmneqq0000g5dyo5md5f84"];

const SEED_CONFIG = {
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

// プロバイダータイプの定義
type OAuthProvider = "google" | "github" | "facebook";
// type ContributionType = "REWARD" | "NON_REWARD";
type EvaluationMethod = "360度評価" | "相互評価" | "目標達成度" | "KPI評価" | "コンピテンシー評価";

// Prismaクライアントのインスタンス化
const prisma = new PrismaClient();

/**
 * データベースをクリーンアップする関数
 * 依存関係を考慮した順序でテーブルを空にします
 * 特定のIDを持つユーザーは削除しません
 */
async function cleanupDatabase() {
  // 通知を削除
  await prisma.notification.deleteMany();

  // 分析データを削除
  await prisma.analytics.deleteMany();

  // タスクを削除
  await prisma.task.deleteMany();

  // グループメンバーシップを削除（保持するユーザーのメンバーシップも削除）
  await prisma.groupMembership.deleteMany();

  // グループを削除
  await prisma.group.deleteMany();

  // ユーザー設定を削除（保持するユーザー以外）
  await prisma.userSettings.deleteMany({
    where: {
      userId: {
        notIn: PRESERVED_USER_IDS,
      },
    },
  });

  // セッションを削除（保持するユーザー以外）
  await prisma.session.deleteMany({
    where: {
      userId: {
        notIn: PRESERVED_USER_IDS,
      },
    },
  });

  // 認証トークンを削除
  await prisma.verificationToken.deleteMany();

  // アカウントを削除（保持するユーザー以外）
  await prisma.account.deleteMany({
    where: {
      userId: {
        notIn: PRESERVED_USER_IDS,
      },
    },
  });

  // ユーザーを削除（保持するユーザー以外）
  await prisma.user.deleteMany({
    where: {
      id: {
        notIn: PRESERVED_USER_IDS,
      },
    },
  });

  console.log("データベースをクリーンアップしました（特定のユーザーは保持しました）");
}

/**
 * ユーザーデータを生成する関数
 * @param count 生成するユーザー数
 * @returns 生成されたユーザーの配列
 */
async function createUsers(count: number) {
  const users = [];

  // まず、保持されたユーザーを取得して配列に追加
  for (const userId of PRESERVED_USER_IDS) {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (existingUser) {
      users.push(existingUser);
      console.log(`既存ユーザー「${existingUser.name}」(ID: ${existingUser.id})を保持しました`);
    }
  }

  // 残りのユーザーを生成
  const remainingCount = count - users.length;

  for (let i = 0; i < remainingCount; i++) {
    const user = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        image: faker.image.avatar(),
        isAppOwner: faker.datatype.boolean(0.1), // 10%の確率でアプリオーナー
      },
    });
    users.push(user);
  }

  console.log(`${users.length}件のユーザーを作成しました（内${users.length - remainingCount}件は既存ユーザー）`);
  return users;
}

// 型定義を修正
type SeedUser = {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
  isAppOwner: boolean;
  emailVerified?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

type SeedGroup = {
  id: string;
  name: string;
  goal: string;
  evaluationMethod: string;
  depositPeriod: number;
  maxParticipants: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  isBlackList: JsonValue; // JSONBの型
};

type SeedParticipant = {
  name: string | null;
  userId?: string | null;
};

type SeedTask = {
  id: string;
  task: string;
  detail?: string | null;
  reference?: string | null;
  category?: string | null;
  status: string;
  fixedContributionPoint?: number | null;
  fixedEvaluatorId?: string | null;
  fixedEvaluationLogic?: string | null;
  fixedEvaluationDate?: Date | null;
  userFixedSubmitterId?: string | null;
  info?: string | null;
  imageUrl?: string | null;
  contributionType: string;
  deliveryMethod?: string | null;
  createdAt: Date;
  updatedAt: Date;
  creatorId: string;
  groupId: string;
  userId?: string; // 一部の関数で使用されている
  reporters?: SeedParticipant[]; // 追加
  executors?: SeedParticipant[]; // 追加
};

type SeedAuction = {
  id: string;
  taskId: string;
  startTime: Date;
  endTime: Date;
  currentHighestBid: number;
  currentHighestBidderId?: string | null;
  winnerId?: string | null;
  status: string;
  extensionTotalCount: number;
  extensionLimitCount: number;
  extensionTotalTime: number;
  extensionLimitTime: number;
  createdAt: Date;
  updatedAt: Date;
  groupId: string; // 追加
};

/**
 * ユーザーに関連するアカウントデータを生成する関数
 * @param users ユーザーの配列
 * @returns 生成されたアカウントの配列
 */
async function createAccounts(users: SeedUser[]) {
  const accounts = [];
  const providers: OAuthProvider[] = ["google", "github", "facebook"];

  for (const user of users) {
    const provider = faker.helpers.arrayElement(providers);
    const account = await prisma.account.create({
      data: {
        userId: user.id,
        type: "oauth",
        provider,
        providerAccountId: `${provider}_${faker.string.uuid()}`,
        refresh_token: faker.string.alphanumeric(40),
        access_token: faker.string.alphanumeric(40),
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "Bearer",
        scope: "openid profile email",
        id_token: faker.string.alphanumeric(50),
      },
    });
    accounts.push(account);
  }

  console.log(`${accounts.length}件のアカウントを作成しました`);
  return accounts;
}

/**
 * ユーザーセッションを生成する関数
 * @param users ユーザーの配列
 * @returns 生成されたセッションの配列
 */
async function createSessions(users: SeedUser[]) {
  const sessions = [];

  for (const user of users) {
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken: faker.string.uuid(),
        expires: faker.date.future(),
      },
    });
    sessions.push(session);
  }

  console.log(`${sessions.length}件のセッションを作成しました`);
  return sessions;
}

/**
 * ユーザー設定を生成する関数
 * @param users ユーザーの配列
 * @returns 生成されたユーザー設定の配列
 */
async function createUserSettings(users: SeedUser[]) {
  const userSettings = [];

  for (const user of users) {
    // ユーザー設定が既に存在するかチェック
    const existingSettings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });

    // 存在しない場合のみ作成
    if (!existingSettings) {
      const userSetting = await prisma.userSettings.create({
        data: {
          userId: user.id,
          username: faker.internet.username(),
          lifeGoal: faker.lorem.paragraph(),
        },
      });
      userSettings.push(userSetting);
    } else {
      console.log(`ユーザーID ${user.id} の設定は既に存在するためスキップします`);
    }
  }

  console.log(`${userSettings.length}件のユーザー設定を作成しました`);
  return userSettings;
}

/**
 * 認証トークンを生成する関数
 * @param count 生成するトークン数
 * @returns 生成された認証トークンの配列
 */
async function createVerificationTokens(count: number) {
  const tokens = [];

  for (let i = 0; i < count; i++) {
    const token = await prisma.verificationToken.create({
      data: {
        identifier: faker.internet.email(),
        token: faker.string.uuid(),
        expires: faker.date.future(),
      },
    });
    tokens.push(token);
  }

  console.log(`${tokens.length}件の認証トークンを作成しました`);
  return tokens;
}

/**
 * グループを生成する関数
 * @param users ユーザーの配列（作成者として使用）
 * @returns 生成されたグループと所属メンバーの配列
 */
async function createGroups(users: SeedUser[]) {
  const groups = [];
  const evaluationMethods: EvaluationMethod[] = ["360度評価", "相互評価", "目標達成度", "KPI評価", "コンピテンシー評価"];

  // グループの数はSEED_CONFIGから取得
  const groupsCount = SEED_CONFIG.GROUPS_COUNT;

  // 保持されたユーザーとそれ以外のユーザーに分ける
  const preservedUsers = users.filter((user) => PRESERVED_USER_IDS.includes(user.id));
  const otherUsers = users.filter((user) => !PRESERVED_USER_IDS.includes(user.id));

  // 作成者リストを作成 (保持ユーザーを優先し、不足分は他のユーザーからランダムに補充)
  const creators = [...preservedUsers, ...faker.helpers.shuffle(otherUsers).slice(0, Math.max(0, groupsCount - preservedUsers.length))].slice(
    0,
    groupsCount,
  ); // グループ数に合わせて作成者数を調整

  // 作成者が不足している場合は警告（通常は発生しないはず）
  if (creators.length < groupsCount) {
    console.warn(`グループ作成者数が不足しています (${creators.length}/${groupsCount})。一部グループは他のユーザーによって作成されます。`);
    // 不足分を他のユーザーから補充（重複しないように）
    const remainingCreatorsNeeded = groupsCount - creators.length;
    const existingCreatorIds = new Set(creators.map((c) => c.id));
    const additionalCreators = faker.helpers.shuffle(otherUsers.filter((u) => !existingCreatorIds.has(u.id))).slice(0, remainingCreatorsNeeded);
    creators.push(...additionalCreators);
  }

  for (let i = 0; i < groupsCount; i++) {
    // 作成者を選択 (リストから順番に割り当て)
    // リストがグループ数より少ない場合（警告が出た場合）は循環させるか、ランダム選択にする
    const creatorUser = creators.length >= groupsCount ? creators[i] : faker.helpers.arrayElement(creators);

    // ポイント預け入れ期間を生成（7〜90日の範囲）
    const depositPeriod = faker.number.int({ min: 7, max: 90 });

    const group = await prisma.group.create({
      data: {
        name: `${faker.company.name()} グループ ${i + 1}`,
        goal: faker.company.catchPhrase(),
        evaluationMethod: faker.helpers.arrayElement(evaluationMethods),
        maxParticipants: faker.number.int({ min: SEED_CONFIG.MIN_MEMBERS_PER_GROUP, max: SEED_CONFIG.MAX_MEMBERS_PER_GROUP * 2 }),
        depositPeriod: depositPeriod,
        createdBy: creatorUser.id,
        isBlackList: {},
      },
    });
    groups.push(group);
  }

  console.log(`${groups.length}件のグループを作成しました`);

  // グループメンバーシップを作成
  const groupMemberships = await createGroupMemberships(groups, users, SEED_CONFIG.MIN_MEMBERS_PER_GROUP, SEED_CONFIG.MAX_MEMBERS_PER_GROUP);

  return { groups, groupMemberships };
}

/**
 * グループメンバーシップを生成する関数
 * @param groups グループの配列
 * @param users ユーザーの配列
 * @param minMembersPerGroup グループごとの最小メンバー数
 * @param maxMembersPerGroup グループごとの最大メンバー数
 * @returns 生成されたグループメンバーシップの配列
 */
async function createGroupMemberships(groups: SeedGroup[], users: SeedUser[], minMembersPerGroup: number, maxMembersPerGroup: number) {
  const memberships = [];
  const membershipSet = new Set<string>(); // 重複チェック用
  const preservedUserIds = new Set(PRESERVED_USER_IDS);
  const preservedUsers = users.filter((user) => preservedUserIds.has(user.id));

  // 各グループにメンバーを追加
  for (const group of groups) {
    // Linter fix: Use for-of loop
    const usersInGroup: SeedUser[] = []; // このグループに参加するユーザー

    // 1. グループ作成者は必ずメンバーにする
    const creator = users.find((u) => u.id === group.createdBy);
    if (creator) {
      usersInGroup.push(creator);
    } else {
      // グループ作成者が見つからない場合（通常ありえないが念のため）
      console.warn(`グループ ${group.id} の作成者 ${group.createdBy} がユーザーリストに見つかりません。`);
      // ランダムなユーザーを一人追加しておく
      if (users.length > 0) {
        usersInGroup.push(faker.helpers.arrayElement(users));
      }
    }

    // 2. 保持ユーザーを優先的にメンバーに追加する (SEED_CONFIGの確率で追加)
    for (const preservedUser of preservedUsers) {
      // 既にグループ作成者として追加されている場合はスキップ
      if (usersInGroup.some((u) => u.id === preservedUser.id)) continue;
      // SEED_CONFIG の確率で参加させる
      if (faker.datatype.boolean(SEED_CONFIG.PRESERVED_USER_JOIN_GROUP_PROBABILITY)) {
        usersInGroup.push(preservedUser);
      }
    }

    // 3. グループに追加する最終的なメンバー数を決定
    const numMembers = faker.number.int({
      min: Math.max(minMembersPerGroup, usersInGroup.length), // 最小メンバー数と既に追加済みの人数を考慮
      max: Math.min(maxMembersPerGroup, users.length, group.maxParticipants), // 最大メンバー数、全ユーザー数、グループの最大参加人数を考慮
    });

    // 4. 不足分のメンバーをランダムに選択（既に追加済みと作成者を除く）
    const remainingCount = numMembers - usersInGroup.length;
    if (remainingCount > 0) {
      const potentialMembers = users.filter((user) => !usersInGroup.some((u) => u.id === user.id));
      // シャッフルして人数分だけ追加
      const additionalMembers = faker.helpers.shuffle(potentialMembers).slice(0, remainingCount);
      usersInGroup.push(...additionalMembers);
    }

    // 5. メンバーシップを作成
    for (const user of usersInGroup) {
      const membershipKey = `${user.id}-${group.id}`;

      // 重複チェック
      if (!membershipSet.has(membershipKey)) {
        membershipSet.add(membershipKey);

        // グループ作成者はグループオーナーとして設定
        const isGroupOwner = group.createdBy === user.id;

        const membership = await prisma.groupMembership.create({
          data: {
            userId: user.id,
            groupId: group.id,
            joinedAt: faker.date.recent({ days: 30 }), // 過去30日以内のランダムな日時
            isGroupOwner,
          },
        });
        memberships.push(membership);
      } else {
        // console.log(`メンバーシップ ${membershipKey} は既に存在します。スキップします。`);
      }
    }
  }

  console.log(`${memberships.length}件のグループメンバーシップを作成しました`);
  return memberships;
}

// 提供方法のリスト（タスクに既に設定されていない場合のデフォルト）
const DELIVERY_METHODS = [
  "Amazonのほしい物リスト",
  "GitHubスポンサー",
  "直接発送（着払い）",
  "オンラインコード送信",
  "オンラインミーティング",
  "チャットでの情報提供",
  "メールでのデータ送信",
];

// カテゴリ別の提供方法マッピング
const CATEGORY_DELIVERY_METHODS: Record<string, string[]> = {
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

/**
 * タスクを生成する関数
 * @param count 生成するタスク数
 * @param groupMemberships グループメンバーシップの配列
 * @param users ユーザーの配列（評価者として使用）
 * @returns 生成されたタスクの配列
 */
async function createTasks(count: number, groupMemberships: { userId: string; groupId: string }[], users: SeedUser[]) {
  const tasks = [];
  const preservedUserIds = new Set(PRESERVED_USER_IDS);
  const preservedUsers = users.filter((user) => preservedUserIds.has(user.id));
  const otherUsers = users.filter((user) => !preservedUserIds.has(user.id)); // 追加: 保持ユーザー以外のリスト

  // TaskStatusの完了系ステータスリスト
  const completedStatuses: TaskStatus[] = [TaskStatus.TASK_COMPLETED, TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED];
  // タスクが完了ステータスになる確率
  // const TASK_COMPLETED_PROBABILITY = 0.3; // SEED_CONFIGから取得するように変更

  for (let i = 0; i < count; i++) {
    // ランダムにグループを選択 (メンバーシップ情報からグループIDを取得)
    if (groupMemberships.length === 0) {
      console.warn("グループメンバーシップが存在しないため、タスクを作成できません。");
      continue; // メンバーシップがない場合はスキップ
    }
    const randomMembership = faker.helpers.arrayElement(groupMemberships);
    let groupId = randomMembership.groupId; // groupId を let で宣言
    let creator: SeedUser;

    // タスク作成者の決定:
    // 1. 最初の数件 (SEED_CONFIG.PRESERVED_USER_CREATE_TASK_INITIAL_COUNT まで) は保持ユーザーが順番に作成者になる
    if (i < SEED_CONFIG.PRESERVED_USER_CREATE_TASK_INITIAL_COUNT && preservedUsers.length > 0) {
      creator = preservedUsers[i % preservedUsers.length];
      // 作成者が選択したグループのメンバーであることを確認（そうでなければ別のグループを選ぶ）
      let attempts = 0;
      let creatorMembership = groupMemberships.find((m) => m.userId === creator.id && m.groupId === groupId);
      while (!creatorMembership && attempts < 10 && groupMemberships.length > 1) {
        const anotherMembership = faker.helpers.arrayElement(groupMemberships.filter((m) => m.groupId !== groupId));
        groupId = anotherMembership.groupId; // 再代入
        creatorMembership = groupMemberships.find((m) => m.userId === creator.id && m.groupId === groupId);
        attempts++;
      }
      // それでも見つからない場合は、ランダムなグループを選ぶ
      if (!creatorMembership) {
        const creatorGroups = groupMemberships.filter((m) => m.userId === creator.id);
        if (creatorGroups.length > 0) {
          groupId = faker.helpers.arrayElement(creatorGroups).groupId; // 再代入
        } else {
          // 保持ユーザーがいずれのグループにも属していない場合（通常ありえない）
          console.warn(`保持ユーザー ${creator.id} がどのグループにも属していません。ランダムなグループを選択します。`);
          groupId = faker.helpers.arrayElement(groupMemberships).groupId; // 再代入
        }
      }
    } else {
      // 2. それ以降は、選択されたグループのメンバーからランダムに作成者を選ぶ
      const potentialCreatorsInGroup = users.filter((u) => groupMemberships.some((m) => m.groupId === groupId && m.userId === u.id));
      if (potentialCreatorsInGroup.length > 0) {
        // グループメンバーの中から、保持ユーザーを優先的に選ぶ確率 (例: 30%)
        const PRESERVED_CREATOR_PROBABILITY = 0.3;
        const preservedCreatorsInGroup = potentialCreatorsInGroup.filter((u) => preservedUserIds.has(u.id));
        if (preservedCreatorsInGroup.length > 0 && faker.datatype.boolean(PRESERVED_CREATOR_PROBABILITY)) {
          creator = faker.helpers.arrayElement(preservedCreatorsInGroup);
        } else {
          // 保持ユーザーを選ばない場合、または保持ユーザーがいない場合は、他のメンバーからランダムに選ぶ
          const otherCreatorsInGroup = potentialCreatorsInGroup.filter((u) => !preservedUserIds.has(u.id));
          creator = faker.helpers.arrayElement(otherCreatorsInGroup.length > 0 ? otherCreatorsInGroup : potentialCreatorsInGroup); // 他のメンバーがいなければ保持ユーザー含む全体から
        }
      } else {
        // グループにメンバーがいない場合（通常ありえない）、全ユーザーからランダムに選ぶ
        console.warn(`グループ ${groupId} にメンバーが存在しません。全ユーザーからタスク作成者を選択します。`);
        creator = faker.helpers.arrayElement(users);
      }
    }

    // タスクの詳細を生成
    const taskTitle = faker.company.catchPhrase();

    // contributionTypeとcategoryを先に決定
    const isReward = faker.datatype.boolean(SEED_CONFIG.TASK_REWARD_PROBABILITY);
    const contributionType = isReward ? "REWARD" : "NON_REWARD";
    const category = faker.helpers.arrayElement(SEED_CONFIG.TASK_CATEGORIES);

    let taskStatus: TaskStatus;
    if (contributionType === "REWARD") {
      // オークション対象となる可能性のあるタスクは、初期ステータスをPENDINGに固定
      // オークションの状況に応じて後で POINTS_DEPOSITED などに変わる
      taskStatus = TaskStatus.PENDING;
    } else {
      // 報酬なしタスクは既存のロジックでステータス決定
      taskStatus = TaskStatus.PENDING; // デフォルトはPENDING
      if (faker.datatype.boolean(SEED_CONFIG.TASK_COMPLETED_PROBABILITY)) {
        taskStatus = faker.helpers.arrayElement(completedStatuses);
      }
    }

    // 評価者と評価ロジック (SEED_CONFIGの確率で設定)
    const hasEvaluator = faker.datatype.boolean(SEED_CONFIG.TASK_EVALUATOR_PROBABILITY);
    // 評価者を選択: 保持ユーザーを優先する (例: 20%の確率で保持ユーザーから選ぶ)
    const PRESERVED_EVALUATOR_PROBABILITY = 0.2;
    let evaluatorUser = null;
    if (hasEvaluator) {
      if (preservedUsers.length > 0 && faker.datatype.boolean(PRESERVED_EVALUATOR_PROBABILITY)) {
        evaluatorUser = faker.helpers.arrayElement(preservedUsers);
      } else {
        evaluatorUser = faker.helpers.arrayElement(otherUsers.length > 0 ? otherUsers : users); // 他のユーザーがいなければ全体から
      }
    }
    const fixedEvaluatorId = evaluatorUser?.id ?? null;
    const fixedEvaluationLogic = hasEvaluator ? faker.lorem.paragraph(1) : null;

    // 固定貢献ポイント (1-100)
    const fixedPoints = faker.number.int({ min: 1, max: 100 });

    // 証拠・結果・補足情報を生成 (SEED_CONFIGの確率で設定)
    const hasInfo = faker.datatype.boolean(SEED_CONFIG.TASK_INFO_PROBABILITY);
    let info = null;
    if (hasInfo) {
      const infoType = faker.helpers.arrayElement(["pullrequest", "achievement", "explanation"]);
      switch (infoType) {
        case "pullrequest":
          const repoName = faker.helpers.arrayElement(["project-x", "web-app", "api-service", "ui-components", "docs"]);
          const orgName = faker.helpers.arrayElement(["acme", "company", "team", "dev-group", "open-source"]);
          const prNumber = faker.number.int({ min: 1, max: 999 });
          info = `プルリクエスト: https://github.com/${orgName}/${repoName}/pull/${prNumber}`;
          break;
        case "achievement":
          const metric = faker.helpers.arrayElement(["パフォーマンス", "ユーザー数", "処理速度", "コード品質", "テストカバレッジ"]);
          const improvement = faker.number.int({ min: 5, max: 95 });
          info = `${metric}が${improvement}%向上しました。詳細: ${faker.internet.url()}`;
          break;
        case "explanation":
          info = faker.lorem.paragraph(2);
          break;
      }
    }

    // TaskReporterとTaskExecutorの準備
    const reportersCount = faker.number.int({ min: SEED_CONFIG.TASK_REPORTER_MIN, max: SEED_CONFIG.TASK_REPORTER_MAX });
    const executorsCount = faker.number.int({ min: SEED_CONFIG.TASK_EXECUTOR_MIN, max: SEED_CONFIG.TASK_EXECUTOR_MAX });

    // --- getParticipants 関数の定義 (createTasks 内に移動) ---
    const getParticipants = (participantCount: number, includePreservedProbability: number): { name: string | null; userId?: string | null }[] => {
      const participants: { name: string | null; userId?: string | null }[] = [];
      const assignedUserIds = new Set<string>(); // 重複割り当てを防ぐ

      // 参加候補者: 作成者自身は除外
      const potentialParticipantUsers = users.filter((u) => u.id !== creator.id);
      const potentialPreserved = potentialParticipantUsers.filter((u) => preservedUserIds.has(u.id));
      const potentialOthers = potentialParticipantUsers.filter((u) => !preservedUserIds.has(u.id));

      // 参加者を追加
      for (let j = 0; j < participantCount; j++) {
        let participantUser: SeedUser | null = null;
        let participantName: string | null = null;

        // まだ割り当てられていない候補者のリスト
        const availablePreserved = potentialPreserved.filter((p) => !assignedUserIds.has(p.id));
        const availableOthers = potentialOthers.filter((o) => !assignedUserIds.has(o.id));
        const availableAll = potentialParticipantUsers.filter((u) => !assignedUserIds.has(u.id));

        // 1. 保持ユーザーを確率的に選択
        if (availablePreserved.length > 0 && faker.datatype.boolean(includePreservedProbability)) {
          participantUser = faker.helpers.arrayElement(availablePreserved);
        }

        // 2. 保持ユーザーを選ばなかった場合、または該当者がいない場合
        if (!participantUser) {
          // 登録ユーザーを70%の確率で選択
          const isRegisteredUser = faker.datatype.boolean(0.7);
          if (isRegisteredUser && availableOthers.length > 0) {
            participantUser = faker.helpers.arrayElement(availableOthers);
          } else if (isRegisteredUser && availableAll.length > 0) {
            // 他のユーザー候補がいないが、全体でまだ割り当てられていない候補者がいる場合
            participantUser = faker.helpers.arrayElement(availableAll);
          }
        }

        // 3. 登録ユーザーを選ばなかった場合、または候補がいなかった場合
        if (!participantUser && !faker.datatype.boolean(0.7)) {
          // 登録ユーザーを選ばなかった場合のみ非登録ユーザーを追加
          participantName = faker.person.fullName();
          participants.push({ name: participantName });
        } else if (participantUser) {
          // 登録ユーザーを割り当て
          participantName = participantUser.name;
          participants.push({ name: participantName, userId: participantUser.id });
          assignedUserIds.add(participantUser.id); // 割り当て済みセットに追加
        } else if (j === participantCount - 1 && participants.length === 0) {
          // ループの最後で、まだ誰も追加されておらず、非登録も選ばれなかった場合、
          // 最後の手段として利用可能な登録ユーザーを追加 (または非登録ユーザー)
          if (availableAll.length > 0) {
            participantUser = faker.helpers.arrayElement(availableAll);
            participantName = participantUser.name;
            participants.push({ name: participantName, userId: participantUser.id });
            assignedUserIds.add(participantUser.id);
          } else {
            participantName = faker.person.fullName();
            participants.push({ name: participantName });
          }
        }
      }

      // 参加者が一人も割り当てられなかった場合は作成者を参加者とする
      if (participants.length === 0 && creator) {
        participants.push({
          name: creator.name,
          userId: creator.id,
        });
      }
      return participants;
    };
    // --- getParticipants 関数の定義ここまで ---

    // 報告者と実行者を選択 (保持ユーザーが含まれる確率をそれぞれ設定)
    // const PRESERVED_REPORTER_PROBABILITY = 0.4; // SEED_CONFIGから取得するように変更
    // const PRESERVED_EXECUTOR_PROBABILITY = 0.4; // SEED_CONFIGから取得するように変更
    const reporters = getParticipants(reportersCount, SEED_CONFIG.PRESERVED_USER_AS_TASK_REPORTER_PROBABILITY);
    const executors = getParticipants(executorsCount, SEED_CONFIG.PRESERVED_USER_AS_TASK_EXECUTOR_PROBABILITY);

    // 出品タイプの場合は提供方法を設定
    let deliveryMethod = null;
    if (contributionType === "REWARD") {
      const categoryMethods = CATEGORY_DELIVERY_METHODS[category] || DELIVERY_METHODS; // category はループの先頭で決定済み
      deliveryMethod = faker.helpers.arrayElement(categoryMethods);
    }

    // 固定提出者を選択: 保持ユーザーを優先する (SEED_CONFIGの確率で保持ユーザーから選ぶ)
    let fixedSubmitterUser = null;
    if (faker.datatype.boolean(SEED_CONFIG.TASK_FIXED_SUBMITTER_PROBABILITY)) {
      // const PRESERVED_SUBMITTER_PROBABILITY = 0.2; // SEED_CONFIGから取得するように変更
      if (preservedUsers.length > 0 && faker.datatype.boolean(SEED_CONFIG.PRESERVED_USER_AS_TASK_SUBMITTER_PROBABILITY)) {
        fixedSubmitterUser = faker.helpers.arrayElement(preservedUsers);
      } else {
        fixedSubmitterUser = faker.helpers.arrayElement(otherUsers.length > 0 ? otherUsers : users); // 他のユーザーがいなければ全体から
      }
    }
    const userFixedSubmitterId = fixedSubmitterUser?.id ?? null;

    // タスク作成
    const task = await prisma.task.create({
      data: {
        task: taskTitle,
        detail: faker.lorem.paragraph(),
        reference: faker.datatype.boolean(SEED_CONFIG.TASK_REFERENCE_PROBABILITY) ? faker.internet.url() : null,
        imageUrl: faker.datatype.boolean(SEED_CONFIG.TASK_IMAGE_URL_PROBABILITY) ? faker.image.urlPicsumPhotos() : null,
        category, // ループの先頭で決定した category を使用
        status: taskStatus,
        fixedContributionPoint: fixedPoints,
        fixedEvaluatorId: fixedEvaluatorId,
        fixedEvaluationLogic,
        fixedEvaluationDate: hasEvaluator ? faker.date.recent() : null,
        info,
        contributionType, // ループの先頭で決定した contributionType を使用
        deliveryMethod,
        creatorId: creator.id,
        userFixedSubmitterId, // 修正: 選択した固定提出者を設定
        groupId,
        reporters: {
          create: reporters,
        },
        executors: {
          create: executors,
        },
      },
    });

    tasks.push(task);
  }

  console.log(`${tasks.length}件のタスクを作成しました`);
  return tasks;
}

/**
 * 分析データを生成する関数
 * @param tasks タスクの配列
 * @param users ユーザーの配列（評価者として使用）
 * @returns 生成された分析データの配列
 */
async function createAnalytics(tasks: SeedTask[], users: SeedUser[]) {
  const analytics = [];
  const preservedUserIds = new Set(PRESERVED_USER_IDS); // 追加

  // 完了したタスクのみ分析対象とする
  const completedStatuses: TaskStatus[] = [TaskStatus.TASK_COMPLETED, TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED];
  const completedTasks = tasks.filter((task) => completedStatuses.includes(task.status as TaskStatus));

  console.log(`${completedTasks.length}件の完了タスクから分析データを作成します`);

  for (const task of completedTasks) {
    const evaluationsCount = faker.number.int({
      min: SEED_CONFIG.ANALYTICS_PER_COMPLETED_TASK_MIN,
      max: SEED_CONFIG.ANALYTICS_PER_COMPLETED_TASK_MAX,
    });

    for (let i = 0; i < evaluationsCount; i++) {
      // 評価者を選択（タスク作成者以外、保持ユーザーを優先的に選択する確率）
      const potentialEvaluators = users.filter((user) => user.id !== task.creatorId);
      const preservedEvaluators = potentialEvaluators.filter((u) => preservedUserIds.has(u.id));
      const otherEvaluators = potentialEvaluators.filter((u) => !preservedUserIds.has(u.id));

      // const PRESERVED_ANALYTICS_EVALUATOR_PROBABILITY = 0.3; // SEED_CONFIGから取得するように変更
      let evaluatorUser: SeedUser | null = null;

      if (potentialEvaluators.length > 0) {
        if (preservedEvaluators.length > 0 && faker.datatype.boolean(SEED_CONFIG.PRESERVED_USER_AS_ANALYTICS_EVALUATOR_PROBABILITY)) {
          evaluatorUser = faker.helpers.arrayElement(preservedEvaluators);
        } else {
          evaluatorUser = faker.helpers.arrayElement(otherEvaluators.length > 0 ? otherEvaluators : potentialEvaluators);
        }
      } else {
        // タスク作成者しかいない場合（通常ありえない）
        console.warn(`タスク ${task.id} の評価者候補がいません。`);
        continue; // この分析データは作成しない
      }

      if (!evaluatorUser) continue; // 評価者が選択されなかった場合
      const evaluatorId = evaluatorUser.id;

      const basePoint = task.fixedContributionPoint ?? faker.number.int({ min: 10, max: 50 });
      const variation = faker.number.int({ min: -5, max: 10 });
      const contributionPoint = Math.max(1, Math.min(100, basePoint + variation));

      const evaluationReasons = [
        "期限内に質の高い成果物を提出した",
        "チームメンバーとの協力が優れていた",
        "追加の作業を自主的に行った",
        "問題解決に創造的なアプローチを示した",
        "技術的に難しい課題を克服した",
        "リソースを効率的に活用した",
        "ドキュメントが詳細で分かりやすかった",
        "フィードバックに基づいて迅速に改善した",
      ];
      const selectedReasons = faker.helpers.arrayElements(evaluationReasons, faker.number.int({ min: 2, max: 3 }));
      const evaluationLogic = selectedReasons.join("。") + "。";

      const analytic = await prisma.analytics.create({
        data: {
          taskId: task.id,
          groupId: task.groupId,
          evaluator: evaluatorId, // evaluatorId を使用
          contributionPoint,
          evaluationLogic,
        },
      });
      analytics.push(analytic);
    }
  }

  console.log(`${analytics.length}件の分析データを作成しました`);
  return analytics;
}

/**
 * 通知データを生成する関数 (オークション関連を除く)
 * @param users ユーザーの配列
 * @param groups グループの配列
 * @param tasks タスクの配列
 * @param groupMemberships グループメンバーシップの配列 // 追加
 * @returns 生成された通知の配列
 */
async function createNotifications(
  users: SeedUser[],
  groups: SeedGroup[],
  tasks: SeedTask[],
  groupMemberships: Prisma.GroupMembershipGetPayload<{ select: { userId: true; groupId: true } }>[], // Linterエラー修正: 型を具体的に指定
) {
  const notifications = [];
  // オークション関連のターゲットタイプを除外
  const targetTypes = Object.values(NotificationTargetType).filter(
    (t) => t !== NotificationTargetType.AUCTION_SELLER && t !== NotificationTargetType.AUCTION_BIDDER,
  );
  const preservedUserIds = new Set(PRESERVED_USER_IDS);
  const preservedUsers = users.filter((user) => preservedUserIds.has(user.id));
  const otherUsers = users.filter((user) => !preservedUserIds.has(user.id));

  const allUsers = [...preservedUsers, ...otherUsers]; // 保持ユーザーを先頭に

  // 各ユーザーに対して通知を生成 (通知の「受信者」としてのループ)
  for (const recipientUser of allUsers) {
    const notificationCount = faker.number.int({
      min: SEED_CONFIG.NOTIFICATIONS_PER_USER_MIN,
      max: SEED_CONFIG.NOTIFICATIONS_PER_USER_MAX,
    });

    for (let i = 0; i < notificationCount; i++) {
      const targetType = faker.helpers.arrayElement(targetTypes);
      const daysPast = faker.number.int({ min: 1, max: 30 }); // minを1に変更
      const sentAt = faker.date.recent({ days: daysPast }); // よりシンプルに

      let title: string,
        message: string,
        actionUrl: string | null = null;
      let groupId: string | null = null;
      let taskId: string | null = null;
      // 通知の「送信者」を決定 (SYSTEM通知以外)
      let senderUser: SeedUser | null = null;
      if (targetType !== "SYSTEM") {
        // 送信者候補 (受信者以外)
        const potentialSenders = users.filter((u) => u.id !== recipientUser.id);
        const preservedSenders = potentialSenders.filter((u) => preservedUserIds.has(u.id));
        const otherSenders = potentialSenders.filter((u) => !preservedUserIds.has(u.id));

        // const PRESERVED_SENDER_PROBABILITY = 0.2; // SEED_CONFIGから取得するように変更
        if (potentialSenders.length > 0) {
          if (preservedSenders.length > 0 && faker.datatype.boolean(SEED_CONFIG.PRESERVED_USER_AS_NOTIFICATION_SENDER_PROBABILITY)) {
            senderUser = faker.helpers.arrayElement(preservedSenders);
          } else {
            senderUser = faker.helpers.arrayElement(otherSenders.length > 0 ? otherSenders : potentialSenders);
          }
        }
      }
      const senderUserId = senderUser?.id ?? null; // システム通知の場合は null

      switch (targetType) {
        case "SYSTEM":
          title = faker.helpers.arrayElement(["システムメンテナンス", "お知らせ", "アップデート情報"]);
          message = faker.lorem.paragraph();
          break;
        case "USER":
          title = faker.helpers.arrayElement(["アカウント情報更新", "プロフィール確認", "個人設定変更"]);
          // 送信者がいる場合はメッセージに含める
          message = senderUser ? `${senderUser.name}さんからのお知らせ: ${faker.lorem.sentence()}` : faker.lorem.sentence();
          actionUrl = `/dashboard/profile/${recipientUser.id}`; // 受信者のプロフィールへのリンク
          break;
        case "GROUP":
          // 受信者が所属するグループ、または送信者が所属するグループからランダムに選択
          const relevantGroups = groups.filter((g) =>
            groupMemberships.some((m) => m.groupId === g.id && (m.userId === recipientUser.id || (senderUserId && m.userId === senderUserId))),
          );
          const randomGroup =
            relevantGroups.length > 0 ? faker.helpers.arrayElement(relevantGroups) : groups.length > 0 ? faker.helpers.arrayElement(groups) : null;

          if (randomGroup) {
            groupId = randomGroup.id;
            title = faker.helpers.arrayElement([`「${randomGroup.name}」の新着情報`, `「${randomGroup.name}」からのお知らせ`]);
            message = senderUser
              ? `${senderUser.name}さんがグループ「${randomGroup.name}」で投稿しました: ${faker.lorem.paragraph()}`
              : `グループ「${randomGroup.name}」のお知らせ: ${faker.lorem.paragraph()}`;
            actionUrl = `/dashboard/group/${randomGroup.id}`;
          } else {
            // 関連グループがない場合はスキップ
            continue;
          }
          break;
        case "TASK":
          // 受信者または送信者に関連するタスクを選択
          const relevantTasks = tasks.filter((t) => {
            const isCreator = t.creatorId === recipientUser.id || (senderUserId && t.creatorId === senderUserId);
            const isReporter = t.reporters?.some((r) => r.userId === recipientUser.id || (senderUserId && r.userId === senderUserId));
            const isExecutor = t.executors?.some((e) => e.userId === recipientUser.id || (senderUserId && e.userId === senderUserId));
            return Boolean(isCreator) || Boolean(isReporter) || Boolean(isExecutor); // Boolean() でラップ
          });
          const randomTask =
            relevantTasks.length > 0 ? faker.helpers.arrayElement(relevantTasks) : tasks.length > 0 ? faker.helpers.arrayElement(tasks) : null;

          if (randomTask?.id) {
            taskId = randomTask.id;
            groupId = randomTask.groupId ?? null;
            title = faker.helpers.arrayElement([`タスク「${randomTask.task.substring(0, 15)}...」更新`, `タスク期限通知`, `タスク評価完了`]);
            message = senderUser
              ? `${senderUser.name}さんがタスク「${randomTask.task.substring(0, 15)}...」を更新しました。`
              : `タスク「${randomTask.task.substring(0, 15)}...」に関するお知らせです。`;
            actionUrl = `/dashboard/tasks/${randomTask.id}`;
          } else {
            continue; // 有効なタスクがない場合はスキップ
          }
          break;
        default: // 実質 USER, GROUP, TASK のみ考慮
          title = "お知らせ";
          message = faker.lorem.paragraph();
          break;
      }

      const hasExpiry = faker.datatype.boolean(SEED_CONFIG.NOTIFICATION_EXPIRY_PROBABILITY);
      const expiresAt = hasExpiry ? faker.date.future({ refDate: sentAt }) : null;

      // 既読状態のJSONBデータ: 受信者は必ずキーとして含める
      const isReadJsonb: Record<string, { isRead: boolean; readAt: string | null }> = {};
      const recipientIsRead = faker.datatype.boolean(SEED_CONFIG.NOTIFICATION_READ_PROBABILITY);
      isReadJsonb[recipientUser.id] = {
        isRead: recipientIsRead,
        readAt: recipientIsRead ? faker.date.between({ from: sentAt, to: new Date() }).toISOString() : null,
      };
      // 他のランダムなユーザー（保持ユーザー含む）の既読状態も追加
      const otherReadStatusUsers = faker.helpers.arrayElements(
        users.filter((u) => u.id !== recipientUser.id), // 受信者以外
        faker.number.int({ min: 0, max: 2 }), // 0~2人の他のユーザー
      );
      for (const otherUser of otherReadStatusUsers) {
        const isRead = faker.datatype.boolean(0.3); // 他のユーザーは低確率で既読
        isReadJsonb[otherUser.id] = {
          isRead,
          readAt: isRead ? faker.date.between({ from: sentAt, to: new Date() }).toISOString() : null,
        };
      }

      try {
        const notificationData = {
          title,
          message,
          targetType: targetType as NotificationTargetType,
          sendTimingType: "NOW" as NotificationSendTiming, // 型アサーション
          sentAt,
          expiresAt,
          actionUrl,
          senderUserId,
          groupId,
          taskId,
          isRead: isReadJsonb,
          sendMethods: ["IN_APP"] as NotificationSendMethod[], // 型アサーション
          // auctionId, auctionEventType はここでは null or undefined
        };

        const notification = await prisma.notification.create({ data: notificationData });
        notifications.push(notification);
      } catch (error) {
        console.error("通知作成エラー:", error);
        // console.error("エラーデータ:", notificationData); // デバッグ用
      }
    }
  }

  console.log(`${notifications.length}件の通知(非オークション)を作成しました`);
  return notifications;
}

/**
 * オークションを生成する関数
 * @param tasks タスクの配列
 * @param users ユーザーの配列
 * @returns 生成されたオークションの配列
 */
async function createAuctions(tasks: SeedTask[], users: SeedUser[]): Promise<SeedAuction[]> {
  console.log("Creating auctions...");

  const auctions: SeedAuction[] = [];
  const preservedUserIds = new Set(PRESERVED_USER_IDS);

  // タスクから報酬タイプのタスクのみ抽出（contributionType が "REWARD" のもの）
  const rewardTasks = tasks.filter((task) => task.contributionType === "REWARD");

  // 報酬タスクが少ない場合は、追加の報酬タスクを作成 (SEED_CONFIG の最小数まで)
  const minRewardTasks = SEED_CONFIG.MIN_REWARD_TASKS_FOR_AUCTION;
  if (rewardTasks.length < minRewardTasks) {
    console.log(`報酬タスクが少ないため(${rewardTasks.length}件)、NON_REWARDタスクから最大${minRewardTasks - rewardTasks.length}件を変換します`);
    const nonRewardTasks = tasks.filter((task) => task.contributionType === "NON_REWARD");
    const tasksToConvert = faker.helpers.arrayElements(nonRewardTasks, Math.min(nonRewardTasks.length, minRewardTasks - rewardTasks.length));

    for (const task of tasksToConvert) {
      const category = task.category ?? "その他";
      const categoryMethods = CATEGORY_DELIVERY_METHODS[category] ?? DELIVERY_METHODS;
      const deliveryMethod = faker.helpers.arrayElement(categoryMethods);

      await prisma.task.update({
        where: { id: task.id },
        data: {
          contributionType: "REWARD",
          deliveryMethod,
        },
      });
      rewardTasks.push({ ...task, contributionType: "REWARD", deliveryMethod });
    }
  }

  for (const task of rewardTasks) {
    const now = new Date();
    const startTimeOffset = faker.number.int({
      min: SEED_CONFIG.AUCTION_START_TIME_MIN_DAYS_AGO * 24 * 60 * 60 * 1000,
      max: SEED_CONFIG.AUCTION_START_TIME_MAX_DAYS_AGO * 24 * 60 * 60 * 1000,
    });
    const startTime = new Date(now.getTime() + startTimeOffset);

    const endTimeOffset = faker.number.int({
      min: SEED_CONFIG.AUCTION_DURATION_MIN_DAYS * 24 * 60 * 60 * 1000,
      max: SEED_CONFIG.AUCTION_DURATION_MAX_DAYS * 24 * 60 * 60 * 1000,
    });
    const endTime = new Date(startTime.getTime() + endTimeOffset);

    const initialPrice = faker.number.int({ min: SEED_CONFIG.AUCTION_INITIAL_PRICE_MIN, max: SEED_CONFIG.AUCTION_INITIAL_PRICE_MAX });

    let status: AuctionStatus;
    if (startTime > now) {
      status = AuctionStatus.PENDING;
    } else if (endTime > now) {
      status = AuctionStatus.ACTIVE;
    } else {
      status = AuctionStatus.ENDED;
    }

    let currentHighestBid = initialPrice;
    let currentHighestBidderId = null;

    if (status === AuctionStatus.ACTIVE || status === AuctionStatus.ENDED) {
      const potentialBidders = users.filter((user) => user.id !== task.creatorId);
      const preservedBidders = potentialBidders.filter((user) => preservedUserIds.has(user.id));
      const otherBidders = potentialBidders.filter((user) => !preservedUserIds.has(user.id));

      if (potentialBidders.length > 0) {
        const hasBids = faker.datatype.boolean(SEED_CONFIG.AUCTION_HAS_BIDS_PROBABILITY);
        if (hasBids) {
          // const PRESERVED_HIGHEST_BIDDER_PROBABILITY = 0.5; // SEED_CONFIGから取得するように変更
          let highestBidder = null;
          if (preservedBidders.length > 0 && faker.datatype.boolean(SEED_CONFIG.PRESERVED_USER_AS_AUCTION_HIGHEST_BIDDER_PROBABILITY)) {
            highestBidder = faker.helpers.arrayElement(preservedBidders);
          } else {
            highestBidder = faker.helpers.arrayElement(otherBidders.length > 0 ? otherBidders : potentialBidders);
          }
          currentHighestBidderId = highestBidder.id;

          const bidIncrease =
            initialPrice *
            (SEED_CONFIG.AUCTION_BID_INCREASE_MIN_PERCENT +
              faker.number.float({ min: 0, max: SEED_CONFIG.AUCTION_BID_INCREASE_MAX_PERCENT - SEED_CONFIG.AUCTION_BID_INCREASE_MIN_PERCENT }));
          currentHighestBid = Math.floor(initialPrice + bidIncrease);
        }
      }
    }

    let winnerId = null;
    if (status === AuctionStatus.ENDED && currentHighestBidderId) {
      winnerId = currentHighestBidderId;
    }

    let deliveryMethod = task.deliveryMethod;
    if (!deliveryMethod) {
      const category = task.category ?? "その他";
      const categoryMethods = CATEGORY_DELIVERY_METHODS[category] ?? DELIVERY_METHODS;
      deliveryMethod = faker.helpers.arrayElement(categoryMethods);
      await prisma.task.update({
        where: { id: task.id },
        data: { deliveryMethod },
      });
    }

    // Use a type that matches prisma create data structure
    const auctionDataForCreation: Prisma.AuctionCreateInput = {
      task: { connect: { id: task.id } },
      group: { connect: { id: task.groupId } },
      currentHighestBid,
      startTime,
      endTime,
      status,
      currentHighestBidder: currentHighestBidderId ? { connect: { id: currentHighestBidderId } } : undefined,
      winner: winnerId ? { connect: { id: winnerId } } : undefined,
    };

    const auction = await prisma.auction.create({
      data: auctionDataForCreation,
    });

    // Push a SeedAuction compatible object
    auctions.push({
      id: auction.id, // Add id
      taskId: task.id,
      startTime: auction.startTime, // Use generated startTime
      endTime: auction.endTime, // Use generated endTime
      currentHighestBid: auction.currentHighestBid, // Use generated bid
      currentHighestBidderId: auction.currentHighestBidderId, // Use generated bidderId
      winnerId: auction.winnerId, // Use generated winnerId
      status: auction.status, // Use generated status
      extensionTotalCount: auction.extensionTotalCount, // Default from prisma
      extensionLimitCount: auction.extensionLimitCount, // Default from prisma
      extensionTotalTime: auction.extensionTotalTime, // Default from prisma
      extensionLimitTime: auction.extensionLimitTime, // Default from prisma
      createdAt: auction.createdAt, // Default from prisma
      updatedAt: auction.updatedAt, // Default from prisma
      groupId: task.groupId,
    });
  }

  console.log(`Created ${auctions.length} auctions`);
  return auctions;
}

// 入札履歴の生成
async function createBidHistories(auctions: SeedAuction[], users: SeedUser[]) {
  console.log("Creating bid histories...");

  const bidHistories = [];
  const preservedUserIds = new Set(PRESERVED_USER_IDS);

  for (const auction of auctions) {
    if (auction.status === AuctionStatus.PENDING) continue;

    const task = await prisma.task.findUnique({
      where: { id: auction.taskId },
      select: { creatorId: true },
    });
    if (!task) continue;

    // オークションのグループメンバーシップを取得
    const groupMembers = await prisma.groupMembership.findMany({
      where: { groupId: auction.groupId },
      select: { userId: true },
    });
    const groupMemberIds = new Set(groupMembers.map((gm) => gm.userId));

    // 潜在的な入札者をグループメンバーかつタスク作成者でないユーザーに限定
    const potentialBidders = users.filter((user) => user.id !== task.creatorId && groupMemberIds.has(user.id));

    const preservedBidders = potentialBidders.filter((user) => preservedUserIds.has(user.id));
    const otherBidders = potentialBidders.filter((user) => !preservedUserIds.has(user.id));

    if (potentialBidders.length === 0) continue;

    const bidCount = faker.number.int({ min: SEED_CONFIG.BIDS_PER_AUCTION_MIN, max: SEED_CONFIG.BIDS_PER_AUCTION_MAX });
    // if (bidCount === 0) continue; // この行を削除

    // Fetch the initial price directly from the created auction record
    // We need the actual initial price, not the potentially updated currentHighestBid from the SeedAuction object if bids were already placed in createAuctions
    const dbAuction = await prisma.auction.findUnique({
      where: { id: auction.id },
      select: { startTime: true, endTime: true, currentHighestBid: true }, // Select necessary fields
    });

    if (!dbAuction) {
      console.warn(`Auction ${auction.id} not found in DB for bid history creation.`);
      continue;
    }

    // Use the currentHighestBid from the DB record as the base for initial price
    // This reflects the state *before* this bid history loop potentially increases it.
    // If createAuctions set a highest bid, that's our starting point here. Otherwise, it's the initial price.
    const initialPrice = dbAuction.currentHighestBid;
    let currentBid = initialPrice; // Start bidding from the actual current highest bid

    const bidTimeRange = Math.max(0, dbAuction.endTime.getTime() - dbAuction.startTime.getTime());
    const bidTimes = Array(bidCount)
      .fill(0)
      .map(() => new Date(dbAuction.startTime.getTime() + faker.number.float() * bidTimeRange))
      .sort((a, b) => a.getTime() - b.getTime());

    const bidRecords: BidHistory[] = []; // 型指定を修正

    for (let i = 0; i < bidCount; i++) {
      // const PRESERVED_BIDDER_PROBABILITY = 0.4; // SEED_CONFIGから取得するように変更
      let bidder = null;
      if (preservedBidders.length > 0 && faker.datatype.boolean(SEED_CONFIG.PRESERVED_USER_AS_BIDDER_PROBABILITY)) {
        bidder = faker.helpers.arrayElement(preservedBidders);
      } else {
        bidder = faker.helpers.arrayElement(otherBidders.length > 0 ? otherBidders : potentialBidders);
      }

      // Calculate bid increase based on the *current* bid amount in the loop
      const bidIncrease =
        currentBid *
        (SEED_CONFIG.BID_INCREASE_MIN_PERCENT +
          faker.number.float({ min: 0, max: SEED_CONFIG.BID_INCREASE_MAX_PERCENT - SEED_CONFIG.BID_INCREASE_MIN_PERCENT }));
      // Ensure the new bid is at least the initial price + 1, and at least current bid + 1
      currentBid = Math.max(initialPrice + 1, currentBid + 1, Math.floor(currentBid + bidIncrease));

      const isAutoBid = faker.datatype.boolean(SEED_CONFIG.BID_IS_AUTOBID_PROBABILITY);
      const bidStatus = BidStatus.BIDDING;

      try {
        const bid = await prisma.bidHistory.create({
          data: {
            auctionId: auction.id,
            userId: bidder.id,
            amount: currentBid,
            isAutoBid,
            createdAt: bidTimes[i],
            status: bidStatus,
          },
        });
        bidRecords.push(bid);
        bidHistories.push(bid);
      } catch (error) {
        console.error(`入札履歴作成エラー: AuctionID=${auction.id}, UserID=${bidder.id}`, error);
      }
    }

    // --- Auction status update logic after bids (Transaction part) ---
    if (auction.status === AuctionStatus.ENDED) {
      await prisma.$transaction(async (tx) => {
        let winnerFound = false;
        // Linter fix: winner の型を明示的に指定
        let winner: { id: string; userId: string; amount: number; status: BidStatus; depositPoint: number | null } | null = null;
        let depositAmount = 0;

        if (bidRecords.length > 0) {
          // 入札がある場合のみ落札者決定ロジックを実行
          const sortedBids = [...bidRecords].sort((a, b) => b.amount - a.amount); // Create a new sorted array

          for (let i = 0; i < sortedBids.length; i++) {
            const currentBid = sortedBids[i];
            // Fetch the latest status of the bid before potentially updating it
            const latestBidStatus = await tx.bidHistory.findUnique({ where: { id: currentBid.id }, select: { status: true } });
            if (latestBidStatus?.status !== BidStatus.BIDDING) continue; // Skip if already processed (e.g., INSUFFICIENT from previous iteration)

            const nextBid = i < sortedBids.length - 1 ? sortedBids[i + 1] : null;
            depositAmount = nextBid ? nextBid.amount + 1 : currentBid.amount;

            const groupPoint = await tx.groupPoint.findFirst({
              where: { userId: currentBid.userId, groupId: auction.groupId },
            });

            if (groupPoint && groupPoint.balance >= depositAmount) {
              // Linter Fix: winner の型に合わせるために必要なフィールドだけを選択する
              const bidForWinner = await tx.bidHistory.findUnique({
                where: { id: currentBid.id },
                select: { id: true, userId: true, amount: true, status: true, depositPoint: true },
              });
              if (bidForWinner) {
                winner = { ...bidForWinner, depositPoint: depositAmount };
              }
              winnerFound = true;

              await tx.bidHistory.update({
                where: { id: currentBid.id },
                // Linter Fix: Use explicit key-value pair
                data: { status: BidStatus.WON, depositPoint: depositAmount },
              });

              await tx.groupPoint.update({
                where: { id: groupPoint.id },
                data: { balance: { decrement: depositAmount } },
              });

              await tx.auction.update({
                where: { id: auction.id },
                data: { winnerId: currentBid.userId }, // Update winnerId on Auction
              });
              break;
            } else {
              await tx.bidHistory.update({
                where: { id: currentBid.id },
                data: { status: BidStatus.INSUFFICIENT },
              });
            }
          }

          // Update remaining bidding bids to LOST
          for (const bid of sortedBids) {
            // Fetch the latest status again before potentially updating to LOST
            const latestBid = await tx.bidHistory.findUnique({ where: { id: bid.id }, select: { status: true } });
            if (latestBid?.status === BidStatus.BIDDING) {
              // Only update if it's still BIDDING
              await tx.bidHistory.update({
                where: { id: bid.id },
                data: { status: BidStatus.LOST },
              });
            }
          }
          // Notifications for losers - CORRECT PLACEMENT IS HERE
          for (const bid of sortedBids) {
            const latestBid = await tx.bidHistory.findUnique({ where: { id: bid.id }, select: { status: true } });
            if (latestBid?.status === BidStatus.LOST) {
              const loserReadStatus = { [bid.userId]: { isRead: false, readAt: null } };
              await tx.notification.create({
                data: {
                  title: generateNotificationTitle("AUCTION_LOST"),
                  message: generateNotificationMessage("AUCTION_LOST", auction),
                  targetType: "AUCTION_BIDDER",
                  auctionEventType: "AUCTION_LOST",
                  sendTimingType: "NOW",
                  sendMethods: ["IN_APP"],
                  auctionId: auction.id,
                  isRead: loserReadStatus,
                  senderUserId: null,
                },
              });
            }
          }
        } // End of if (bidRecords.length > 0)

        // Update task status if winner found
        if (winnerFound) {
          await tx.task.update({
            where: { id: auction.taskId },
            data: { status: TaskStatus.POINTS_DEPOSITED },
          });
        } else {
          // オークションが終了し、落札者がいなかった場合 (入札が0件の場合も含む)
          const currentTask = await tx.task.findUnique({
            where: { id: auction.taskId },
            select: { status: true },
          });
          // PENDING の場合のみ ARCHIVED に更新する
          if (currentTask && currentTask.status === TaskStatus.PENDING) {
            await tx.task.update({
              where: { id: auction.taskId },
              data: { status: TaskStatus.ARCHIVED },
            });
          }
        }

        // --- Notification creation ---
        const taskSeller = await tx.task.findUnique({
          where: { id: auction.taskId },
          select: { creatorId: true },
        });

        if (taskSeller) {
          const sellerId = taskSeller.creatorId;
          const sellerReadStatus = { [sellerId]: { isRead: false, readAt: null } };

          if (winnerFound && winner) {
            const winnerReadStatus = { [winner.userId]: { isRead: false, readAt: null } };
            // Item sold notification to seller
            await tx.notification.create({
              data: {
                title: generateNotificationTitle("ITEM_SOLD"),
                message: generateNotificationMessage("ITEM_SOLD", auction),
                targetType: "AUCTION_SELLER",
                auctionEventType: "ITEM_SOLD",
                sendTimingType: "NOW",
                sendMethods: ["IN_APP"],
                auctionId: auction.id,
                isRead: sellerReadStatus,
                senderUserId: null,
              },
            });
            // Auction win notification to winner
            await tx.notification.create({
              data: {
                title: generateNotificationTitle("AUCTION_WIN"),
                message: generateNotificationMessage("AUCTION_WIN", auction),
                targetType: "AUCTION_BIDDER",
                auctionEventType: "AUCTION_WIN",
                sendTimingType: "NOW",
                sendMethods: ["IN_APP"],
                auctionId: auction.id,
                isRead: winnerReadStatus,
                senderUserId: null,
              },
            });
          } else {
            // No winner notification to seller
            await tx.notification.create({
              data: {
                title: generateNotificationTitle("NO_WINNER"),
                message: generateNotificationMessage("NO_WINNER", auction),
                targetType: "AUCTION_SELLER",
                auctionEventType: "NO_WINNER",
                sendTimingType: "NOW",
                sendMethods: ["IN_APP"],
                auctionId: auction.id,
                isRead: sellerReadStatus,
                senderUserId: null,
              },
            });
          }

          // Auction ended notification to seller
          await tx.notification.create({
            data: {
              title: generateNotificationTitle("ENDED"),
              message: generateNotificationMessage("ENDED", auction),
              targetType: "AUCTION_SELLER",
              auctionEventType: "ENDED",
              sendTimingType: "NOW",
              sendMethods: ["IN_APP"],
              auctionId: auction.id,
              isRead: sellerReadStatus,
              senderUserId: null,
            },
          });

          // The "Notifications for losers" loop has been moved inside the "if (bidRecords.length > 0)" block.
          // Any remaining comments or old logic for loser notifications here should be removed.
        }
      });
    } else if (auction.status === AuctionStatus.ACTIVE && bidRecords.length > 0) {
      // アクティブなオークションの処理 (変更なし)
      // Update current highest bid for ACTIVE auctions
      const sortedBids = [...bidRecords].sort((a, b) => b.amount - a.amount); // Add this line to define sortedBids
      const highestBid = sortedBids[0]; // Use sortedBids here
      if (highestBid) {
        try {
          // Only update if the new bid is higher than the current one in the DB
          const currentDbAuction = await prisma.auction.findUnique({
            where: { id: auction.id },
            select: { currentHighestBid: true },
          });
          if (currentDbAuction && highestBid.amount > currentDbAuction.currentHighestBid) {
            await prisma.auction.update({
              where: { id: auction.id },
              data: {
                currentHighestBid: highestBid.amount,
                currentHighestBidderId: highestBid.userId,
              },
            });
          }
        } catch (error) {
          console.error(`オークション最高入札額更新エラー: AuctionID=${auction.id}`, error);
        }
      }

      // Notifications for losers - ここに移動
      for (const bid of sortedBids) {
        // sortedBids はこのスコープで見える
        const latestBid = await prisma.bidHistory.findUnique({ where: { id: bid.id }, select: { status: true } });
        if (latestBid?.status === BidStatus.LOST) {
          // LOST になった入札に対して通知
          const loserReadStatus = { [bid.userId]: { isRead: false, readAt: null } };
          await prisma.notification.create({
            data: {
              title: generateNotificationTitle("AUCTION_LOST"),
              message: generateNotificationMessage("AUCTION_LOST", auction),
              targetType: "AUCTION_BIDDER",
              auctionEventType: "AUCTION_LOST",
              sendTimingType: "NOW",
              sendMethods: ["IN_APP"],
              auctionId: auction.id,
              isRead: loserReadStatus,
              senderUserId: null,
            },
          });
        }
      }
    }
  }

  console.log(`Created ${bidHistories.length} bid histories`);
  return bidHistories;
}

// 自動入札設定の生成
async function createAutoBids(auctions: SeedAuction[], users: SeedUser[]) {
  console.log("Creating auto bids...");

  const autoBids = [];

  // アクティブなオークションのみを対象
  const activeAuctions = auctions.filter((auction) => auction.status === AuctionStatus.ACTIVE);

  for (const auction of activeAuctions) {
    // 関連するタスクを取得
    const task = await prisma.task.findUnique({
      where: { id: auction.taskId },
      select: { creatorId: true },
    });

    if (!task) continue;

    // タスク作成者以外のユーザーを候補として抽出
    const potentialUsers = users.filter((user) => user.id !== task.creatorId);
    const preservedUsersForAutoBid = potentialUsers.filter((user) => PRESERVED_USER_IDS.includes(user.id));
    const otherUsersForAutoBid = potentialUsers.filter((user) => !PRESERVED_USER_IDS.includes(user.id));

    if (potentialUsers.length === 0) continue;

    // 自動入札設定を持つユーザー数（指定範囲）
    const autoBidUserCount = faker.number.int({ min: SEED_CONFIG.AUTOBIDS_PER_AUCTION_MIN, max: SEED_CONFIG.AUTOBIDS_PER_AUCTION_MAX });
    if (autoBidUserCount === 0) continue;

    // ランダムにユーザーを選択（保持ユーザーを優先）
    const autoBidUsers = faker.helpers.arrayElements(
      preservedUsersForAutoBid.length > 0 ? preservedUsersForAutoBid : otherUsersForAutoBid,
      Math.min(autoBidUserCount, potentialUsers.length), // 候補者数を超えないように
    );

    for (const user of autoBidUsers) {
      // 自動入札の最大金額は現在の最高入札額の指定%増し
      // Linter Fix: Add closing parenthesis
      const maxBidAmount = Math.floor(
        auction.currentHighestBid *
          (SEED_CONFIG.AUTOBID_MAX_INCREASE_MIN_PERCENT +
            faker.number.float({ min: 0, max: SEED_CONFIG.AUTOBID_MAX_INCREASE_MAX_PERCENT - SEED_CONFIG.AUTOBID_MAX_INCREASE_MIN_PERCENT })),
      );
      // 入札単位は指定範囲でランダム
      const bidIncrement = faker.number.int({ min: SEED_CONFIG.AUTOBID_INCREMENT_MIN, max: SEED_CONFIG.AUTOBID_INCREMENT_MAX });

      try {
        const autoBid = await prisma.autoBid.create({
          data: {
            user: { connect: { id: user.id } },
            auction: { connect: { id: auction.id } },
            maxBidAmount,
            bidIncrement,
            isActive: true,
            lastBidTime: new Date(new Date().getTime() - faker.number.int({ min: 1, max: 24 }) * 60 * 60 * 1000),
          },
        });

        autoBids.push(autoBid);
      } catch (error) {
        console.error("自動入札設定作成エラー:", error);
      }
    }
  }

  console.log(`Created ${autoBids.length} auto bids`);
  return autoBids;
}

/**
 * オークション通知を生成する関数
 * @param auctions オークションの配列
 * @param users ユーザーの配列
 * @returns 生成された通知の配列
 */
async function createAuctionNotifications(auctions: SeedAuction[], users: SeedUser[]) {
  console.log("Creating auction notifications...");

  const notifications = [];
  const preservedUserIds = new Set(PRESERVED_USER_IDS);

  // 各ユーザーに対して通知を生成 (受信者としてのループ)
  for (const recipientUser of users) {
    // ユーザーが関わっているオークション（出品者、入札者、落札者、ウォッチリスト登録者）
    const relatedAuctions = await prisma.auction.findMany({
      where: {
        OR: [
          { task: { creatorId: recipientUser.id } }, // 出品者
          { bidHistories: { some: { userId: recipientUser.id } } }, // 入札者
          { winnerId: recipientUser.id }, // 落札者
          { watchlists: { some: { userId: recipientUser.id } } }, // ウォッチリスト登録者
        ],
      },
      include: {
        task: { select: { creatorId: true, task: true, deliveryMethod: true } },
        bidHistories: { where: { userId: recipientUser.id }, select: { status: true } },
      }, // 関連情報も取得
    });

    // 関連オークションがない場合でも、保持ユーザーなら他のオークション通知を受け取る可能性
    const isPreservedUser = preservedUserIds.has(recipientUser.id);
    const auctionsToNotify: (SeedAuction & {
      task?: { creatorId: string; task?: string; deliveryMethod?: string | null };
      bidHistories?: { status: BidStatus }[];
    })[] = relatedAuctions;
    if (isPreservedUser && relatedAuctions.length < 2 && auctions.length >= 2) {
      const otherAuctionIds = auctions.filter((a) => !relatedAuctions.some((ra) => ra.id === a.id)).map((a) => a.id);
      if (otherAuctionIds.length > 0) {
        const otherAuctionsData = await prisma.auction.findMany({
          where: { id: { in: faker.helpers.arrayElements(otherAuctionIds, 2 - relatedAuctions.length) } },
          include: {
            task: { select: { creatorId: true, task: true, deliveryMethod: true } },
            bidHistories: { where: { userId: recipientUser.id }, select: { status: true } },
          },
        });
        auctionsToNotify.push(...otherAuctionsData);
      }
    }

    if (auctionsToNotify.length === 0) continue;

    for (const auction of auctionsToNotify) {
      const sellerId = auction.task?.creatorId;
      if (!sellerId) continue; // 出品者不明の場合はスキップ

      const notificationCount = faker.number.int({
        min: SEED_CONFIG.AUCTION_NOTIFICATIONS_PER_RELEVANT_AUCTION_MIN,
        max: SEED_CONFIG.AUCTION_NOTIFICATIONS_PER_RELEVANT_AUCTION_MAX,
      });

      // 通知タイプのリスト (ユーザーの役割に応じてフィルタリング)
      let possibleEventTypes: AuctionEventType[] = [];
      if (recipientUser.id === sellerId) {
        // 受信者が出品者
        possibleEventTypes = [
          AuctionEventType.ITEM_SOLD,
          AuctionEventType.NO_WINNER,
          AuctionEventType.ENDED,
          AuctionEventType.QUESTION_RECEIVED,
          AuctionEventType.AUCTION_CANCELED,
        ];
      } else {
        // 受信者が出品者以外
        possibleEventTypes = [
          AuctionEventType.OUTBID,
          AuctionEventType.ENDED,
          AuctionEventType.AUCTION_WIN,
          AuctionEventType.AUCTION_LOST,
          AuctionEventType.POINT_RETURNED,
          AuctionEventType.AUTO_BID_LIMIT_REACHED,
          AuctionEventType.AUCTION_CANCELED,
        ];
        if (auction.winnerId !== recipientUser.id) {
          possibleEventTypes = possibleEventTypes.filter((t) => t !== AuctionEventType.AUCTION_WIN);
        }
        // bidHistories を auction オブジェクトから直接参照
        const hasBid = auction.bidHistories && auction.bidHistories.length > 0;
        if (!hasBid) {
          // possibleEventTypes = possibleEventTypes.filter(t => !([AuctionEventType.OUTBID, AuctionEventType.AUCTION_LOST, AuctionEventType.AUTO_BID_LIMIT_REACHED] as const).includes(t));
          const excludedTypes: AuctionEventType[] = [AuctionEventType.OUTBID, AuctionEventType.AUCTION_LOST, AuctionEventType.AUTO_BID_LIMIT_REACHED]; // 型を明示
          possibleEventTypes = possibleEventTypes.filter((t) => !excludedTypes.some((excluded) => excluded === t)); // some を使用して書き換え
        }
        // Lost していない場合は AUCTION_LOST を除外
        if (hasBid && !auction.bidHistories?.some((b) => b.status === BidStatus.LOST)) {
          possibleEventTypes = possibleEventTypes.filter((t) => t !== AuctionEventType.AUCTION_LOST);
        }
        // Won していない場合は POINT_RETURNED (落札ポイント返還) を除外 (負けた場合の返還もあるが、ここでは単純化)
        if (auction.winnerId !== recipientUser.id) {
          possibleEventTypes = possibleEventTypes.filter((t) => t !== AuctionEventType.POINT_RETURNED);
        }
      }
      possibleEventTypes = possibleEventTypes.filter((et) => Object.values(AuctionEventType).includes(et));
      if (possibleEventTypes.length === 0) continue;

      for (let i = 0; i < notificationCount; i++) {
        const notificationType = faker.helpers.arrayElement(possibleEventTypes); // AuctionEventTypeがインポートされていれば問題ない

        const createdAt = faker.date.recent({ days: 7 });
        const expiresAt = faker.date.future({ refDate: createdAt });

        const taskInfo = auction.task ? { task: auction.task.task, deliveryMethod: auction.task.deliveryMethod, groupId: auction.groupId } : null;

        let pointReturnDate = null;
        if (notificationType === AuctionEventType.POINT_RETURNED && auction.status === AuctionStatus.ENDED) {
          // AuctionEventTypeを使用
          const group = await prisma.group.findUnique({ where: { id: auction.groupId }, select: { depositPeriod: true } });
          if (group) {
            pointReturnDate = new Date(auction.endTime);
            pointReturnDate.setDate(pointReturnDate.getDate() + group.depositPeriod);
          }
        }

        const sendMethods = faker.helpers.arrayElements(
          ["IN_APP", "EMAIL", "WEB_PUSH"] as const,
          faker.number.int({ min: 1, max: 2 }),
        ) as NotificationSendMethod[];
        const isReadJson = { [recipientUser.id]: { isRead: false, readAt: null } };

        try {
          const title = generateNotificationTitle(notificationType); // AuctionEventTypeが解決されれば問題ない
          const message = generateNotificationMessage(notificationType, auction, taskInfo, pointReturnDate); // AuctionEventTypeが解決されれば問題ない
          const senderUserId = null; // システム通知
          const targetType = recipientUser.id === sellerId ? NotificationTargetType.AUCTION_SELLER : NotificationTargetType.AUCTION_BIDDER;

          const notification = await prisma.notification.create({
            data: {
              title,
              message,
              auctionEventType: notificationType,
              targetType, // AuctionEventTypeが解決されれば問題ない
              sendTimingType: "NOW",
              sendMethods,
              sentAt: createdAt,
              expiresAt,
              actionUrl: `/dashboard/auction/${auction.id}`,
              isRead: isReadJson,
              senderUserId,
              auctionId: auction.id,
              taskId: auction.taskId,
              groupId: taskInfo?.groupId ?? null,
            },
          });
          notifications.push(notification);
        } catch (error) {
          console.error(`オークション通知作成エラー (タイプ: ${notificationType}, 受信者: ${recipientUser.id}):`, error);
        }
      }
    }
  }

  console.log(`Created ${notifications.length} auction notifications`);
  return notifications;
}

// 通知タイトルの生成ヘルパー関数
function generateNotificationTitle(type: string): string {
  switch (type) {
    case "ITEM_SOLD":
      return "商品が落札されました";
    case "NO_WINNER":
      return "落札者がいませんでした";
    case "ENDED":
      return "オークション終了";
    case "OUTBID":
      return "入札が上回られました";
    case "QUESTION_RECEIVED":
      return "質問を受け取りました";
    case "AUTO_BID_LIMIT_REACHED":
      return "自動入札上限に達しました";
    case "AUCTION_WIN":
      return "オークション落札成功";
    case "AUCTION_LOST":
      return "オークション落札失敗";
    case "POINT_RETURNED":
      return "ポイント返還予定のお知らせ";
    default:
      return "オークション通知";
  }
}

// 通知メッセージの生成ヘルパー関数
function generateNotificationMessage(
  type: string,
  auction: SeedAuction,
  task?: { task?: string; deliveryMethod?: string | null; groupId?: string } | null,
  pointReturnDate?: Date | null,
): string {
  const taskTitle = task?.task ? task.task.substring(0, 30) + (task.task.length > 30 ? "..." : "") : "商品";
  const deliveryMethod = task?.deliveryMethod ?? "未定";
  const bidAmount = auction.currentHighestBid.toLocaleString();

  switch (type) {
    case "ITEM_SOLD":
      if (pointReturnDate) {
        const formattedDate = pointReturnDate.toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        return `おめでとうございます！「${taskTitle}」を${bidAmount}ポイントで落札しました。提供方法は「${deliveryMethod}」です。\n預けたポイントは${formattedDate}に返還される予定です。`;
      }
      return `おめでとうございます！「${taskTitle}」を${bidAmount}ポイントで落札しました。提供方法は「${deliveryMethod}」です。`;
    case "NO_WINNER":
      return `残念ながら「${taskTitle}」のオークションで落札できませんでした。入札したポイントは返還されました。`;
    case "ENDED":
      return `「${taskTitle}」のオークションが終了しました。結果を確認してください。`;
    case "OUTBID":
      return `「${taskTitle}」のオークションで、あなたの入札が他のユーザーに上回られました。再入札を検討してください。`;
    case "QUESTION_RECEIVED":
      return `「${taskTitle}」のオークションに関する質問を受け取りました。`;
    case "AUTO_BID_LIMIT_REACHED":
      return `「${taskTitle}」のオークションで自動入札上限に達しました。`;
    case "AUCTION_WIN":
      if (pointReturnDate) {
        const formattedDate = pointReturnDate.toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        return `おめでとうございます！「${taskTitle}」を${bidAmount}ポイントで落札しました。提供方法は「${deliveryMethod}」です。\n預けたポイントは${formattedDate}に返還される予定です。`;
      }
      return `おめでとうございます！「${taskTitle}」を${bidAmount}ポイントで落札しました。提供方法は「${deliveryMethod}」です。`;
    case "AUCTION_LOST":
      return `残念ながら「${taskTitle}」のオークションで落札できませんでした。入札したポイントは返還されました。`;
    case "POINT_RETURNED":
      if (pointReturnDate) {
        const formattedDate = pointReturnDate.toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        return `「${taskTitle}」のオークションで預けた${bidAmount}ポイントは${formattedDate}に返還される予定です。`;
      }
      return `「${taskTitle}」のオークションで使用したポイントが返還されました。`;
    default:
      return `「${taskTitle}」のオークションに関するお知らせです。`;
  }
}

// オークションレビューの生成
async function createAuctionReviews(auctions: SeedAuction[]) {
  console.log("Creating auction reviews...");

  const reviews = [];

  // 終了したオークションのみを対象
  const endedAuctions = auctions.filter((auction) => auction.status === AuctionStatus.ENDED && auction.winnerId !== null);

  // 完了証明URLのパターン
  const proofUrlPatterns = [
    "https://example.com/proof/",
    "https://img-service.com/completion/",
    "https://storage.googleapis.com/proof-images/",
    null, // 証明なしのケース
  ];

  for (const auction of endedAuctions) {
    // 関連するタスクを取得
    const task = await prisma.task.findUnique({
      where: { id: auction.taskId },
      select: { creatorId: true },
    });

    if (!task) continue;

    // レビューが存在する確率（SEED_CONFIG の確率）
    const hasReview = faker.datatype.boolean(SEED_CONFIG.AUCTION_REVIEW_PROBABILITY);
    if (!hasReview) continue;

    // 売り手（タスク作成者）から買い手（落札者）へのレビュー
    try {
      // 完了証明URLの生成（指定確率で存在）
      const hasProofUrl = faker.datatype.boolean(SEED_CONFIG.AUCTION_PROOF_URL_PROBABILITY);
      const proofUrlBase = hasProofUrl ? faker.helpers.arrayElement(proofUrlPatterns.filter(Boolean)) : null;
      const completionProofUrl = proofUrlBase ? `${proofUrlBase}${faker.string.uuid()}.jpg` : null;

      const sellerReviewComments = [
        "とても良い取引相手でした。スムーズに取引が完了しました。",
        "迅速な対応に感謝します。また機会があれば取引したいです。",
        "丁寧な対応でした。約束通りの取引ができました。",
        "問題なく取引できました。信頼できる相手です。",
        "コミュニケーションが円滑で、理解力の高い方でした。",
        "非常に協力的で、取引がとてもスムーズでした。",
        "また取引したいです。とても満足しています。",
      ];

      const sellerReview = await prisma.auctionReview.create({
        data: {
          auction: { connect: { id: auction.id } },
          reviewer: { connect: { id: task.creatorId } },
          reviewee: { connect: { id: auction.winnerId! } }, // winnerIdが確実に存在することを型アサーションで保証
          rating: faker.number.int({ min: SEED_CONFIG.AUCTION_SELLER_REVIEW_RATING_MIN, max: SEED_CONFIG.AUCTION_SELLER_REVIEW_RATING_MAX }), // 売り手からは比較的高評価
          comment: faker.helpers.arrayElement(sellerReviewComments),
          completionProofUrl,
          // isSellerReview: true, // isSellerReview: true から変更
          reviewPosition: ReviewPosition.SELLER_TO_BUYER,
          createdAt: new Date(auction.endTime.getTime() + faker.number.int({ min: 1, max: 7 * 24 }) * 60 * 60 * 1000),
        },
      });

      reviews.push(sellerReview);
    } catch (error) {
      console.error("売り手レビュー作成エラー:", error);
    }

    // 買い手から売り手へのレビュー（指定確率で存在）
    const hasBuyerToSellerReview = faker.datatype.boolean(SEED_CONFIG.AUCTION_BUYER_TO_SELLER_REVIEW_PROBABILITY);
    if (hasBuyerToSellerReview) {
      try {
        // 完了証明URLの生成（指定確率で存在）
        const hasProofUrl = faker.datatype.boolean(SEED_CONFIG.AUCTION_PROOF_URL_PROBABILITY);
        const proofUrlBase = hasProofUrl ? faker.helpers.arrayElement(proofUrlPatterns.filter(Boolean)) : null;
        const completionProofUrl = proofUrlBase ? `${proofUrlBase}${faker.string.uuid()}.jpg` : null;

        const buyerReviewComments = [
          "商品の状態が良く、満足しています。",
          "丁寧な梱包で安心しました。",
          "説明通りの商品でした。",
          "また利用したいです。対応が迅速でとても良かったです。",
          "迅速な発送に感謝します。良い取引ができました。",
          "期待以上の内容でした。とても満足しています。",
          "正確な情報提供に感謝します。",
          "次回も機会があれば取引したいです。",
        ];

        const buyerReview = await prisma.auctionReview.create({
          data: {
            auction: { connect: { id: auction.id } },
            reviewer: { connect: { id: auction.winnerId! } }, // winnerIdが確実に存在することを型アサーションで保証
            reviewee: { connect: { id: task.creatorId } },
            rating: faker.number.int({ min: SEED_CONFIG.AUCTION_BUYER_REVIEW_RATING_MIN, max: SEED_CONFIG.AUCTION_BUYER_REVIEW_RATING_MAX }), // 買い手からの評価は若干ばらつきがある
            comment: faker.helpers.arrayElement(buyerReviewComments),
            completionProofUrl,
            // isSellerReview: false, // isSellerReview: false から変更
            reviewPosition: ReviewPosition.BUYER_TO_SELLER,
            createdAt: new Date(auction.endTime.getTime() + faker.number.int({ min: 1, max: 7 * 24 }) * 60 * 60 * 1000),
          },
        });

        reviews.push(buyerReview);
      } catch (error) {
        console.error("買い手レビュー作成エラー:", error);
      }
    }
  }

  console.log(`Created ${reviews.length} auction reviews`);
  return reviews;
}

// オークションのウォッチリスト生成
async function createTaskWatchLists(auctions: SeedAuction[], users: SeedUser[]) {
  console.log("Creating task watch lists...");

  const watchLists = [];
  const preservedUserIds = new Set(PRESERVED_USER_IDS); // 追加

  for (const auction of auctions) {
    const task = await prisma.task.findUnique({
      where: { id: auction.taskId },
      select: { creatorId: true },
    });
    if (!task) continue;

    // ウォッチ候補者 (タスク作成者以外)
    const potentialWatchers = users.filter((user) => user.id !== task.creatorId);
    const preservedWatchers = potentialWatchers.filter((user) => preservedUserIds.has(user.id));
    const otherWatchers = potentialWatchers.filter((user) => !preservedUserIds.has(user.id));

    if (potentialWatchers.length === 0) continue;

    const watcherCount = faker.number.int({ min: SEED_CONFIG.WATCHLISTS_PER_AUCTION_MIN, max: SEED_CONFIG.WATCHLISTS_PER_AUCTION_MAX });
    if (watcherCount === 0) continue;

    // ウォッチするユーザーを選択 (保持ユーザーを優先、例: 60%の確率)
    const PRESERVED_WATCHER_PROBABILITY = 0.6;
    const watchers = [];
    const selectedUserIds = new Set<string>();

    for (let i = 0; i < watcherCount && potentialWatchers.length > selectedUserIds.size; i++) {
      let userToSelect: SeedUser | null = null;
      const availablePreserved = preservedWatchers.filter((u) => !selectedUserIds.has(u.id));
      const availableOthers = otherWatchers.filter((u) => !selectedUserIds.has(u.id));
      const availableAll = potentialWatchers.filter((u) => !selectedUserIds.has(u.id));

      if (availablePreserved.length > 0 && faker.datatype.boolean(PRESERVED_WATCHER_PROBABILITY)) {
        userToSelect = faker.helpers.arrayElement(availablePreserved);
      } else if (availableOthers.length > 0) {
        userToSelect = faker.helpers.arrayElement(availableOthers);
      } else if (availableAll.length > 0) {
        userToSelect = faker.helpers.arrayElement(availableAll);
      }

      if (userToSelect) {
        watchers.push(userToSelect);
        selectedUserIds.add(userToSelect.id);
      } else {
        break; // 候補者がいなくなったら終了
      }
    }

    for (const watcher of watchers) {
      try {
        const createdAtTime = faker.date.between({ from: auction.createdAt, to: new Date() });

        const watchList = await prisma.taskWatchList.create({
          data: {
            userId: watcher.id,
            auctionId: auction.id,
            createdAt: createdAtTime,
          },
        });
        watchLists.push(watchList);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          console.warn(`ウォッチリスト重複: UserID=${watcher.id}, AuctionID=${auction.id}`);
        } else {
          console.error("ウォッチリスト作成エラー:", error);
        }
      }
    }
  }

  console.log(`Created ${watchLists.length} watch list entries`);
  return watchLists;
}

// グループポイントの生成
async function createGroupPoints(users: SeedUser[], auctions: SeedAuction[]) {
  console.log("Creating group points...");

  const groupPoints = [];

  // 各ユーザーに対してグループポイントを生成
  for (const user of users) {
    // ユーザーが所属するグループを取得
    const userMemberships = await prisma.groupMembership.findMany({
      where: { userId: user.id },
      include: { group: true },
    });

    if (userMemberships.length === 0) continue;

    // 各グループに対して
    for (const membership of userMemberships) {
      const group = membership.group;

      // 既存のグループポイントレコードを確認
      const existingGroupPoint = await prisma.groupPoint.findUnique({
        where: {
          userId_groupId: {
            userId: user.id,
            groupId: group.id,
          },
        },
      });

      if (existingGroupPoint) {
        console.log(`ユーザー ${user.id} のグループ ${group.id} に対するポイント情報は既に存在します`);
        groupPoints.push(existingGroupPoint);
        continue;
      }

      // 基本のポイント残高と合計ポイント
      let balance = faker.number.int({ min: SEED_CONFIG.GROUP_POINTS_INITIAL_MIN, max: SEED_CONFIG.GROUP_POINTS_INITIAL_MAX });
      const fixedTotalPoints = balance;

      // ユーザーが落札者であるオークションを取得
      const wonAuctions = auctions.filter((auction) => auction.winnerId === user.id && auction.status === AuctionStatus.ENDED);

      // オークションの落札情報からポイント残高を調整
      for (const auction of wonAuctions) {
        // オークションに関連するタスクを取得
        const task = await prisma.task.findUnique({
          where: { id: auction.taskId },
          select: { groupId: true },
        });

        // タスクがこのグループに関連しているか確認
        if (task && task.groupId === group.id) {
          // 落札時に一時的に使用されるポイント
          balance -= auction.currentHighestBid;
          // ただし総獲得ポイントは変わらない
        }
      }

      // バランスが負にならないように調整
      balance = Math.max(0, balance);

      try {
        const groupPoint = await prisma.groupPoint.create({
          data: {
            userId: user.id,
            groupId: group.id,
            balance,
            fixedTotalPoints,
          },
        });

        groupPoints.push(groupPoint);
      } catch (error) {
        console.error("グループポイント作成エラー:", error);
      }
    }
  }

  console.log(`Created ${groupPoints.length} group points records`);
  return groupPoints;
}

// オークションメッセージの生成
async function createAuctionMessages(auctions: SeedAuction[], users: SeedUser[]) {
  console.log("Creating auction messages...");

  const messages = [];
  const preservedUserIds = new Set(PRESERVED_USER_IDS); // 追加

  const targetAuctions = auctions.filter((auction) => auction.status === AuctionStatus.ACTIVE || auction.status === AuctionStatus.ENDED);

  for (const auction of targetAuctions) {
    const task = await prisma.task.findUnique({
      where: { id: auction.taskId },
      select: { creatorId: true },
    });
    if (!task) continue;
    const sellerId = task.creatorId;

    // メッセージ相手の候補 (出品者以外)
    const potentialPartners = users.filter((user) => user.id !== sellerId);
    const preservedPartners = potentialPartners.filter((user) => preservedUserIds.has(user.id));
    const otherPartners = potentialPartners.filter((user) => !preservedUserIds.has(user.id));

    if (potentialPartners.length === 0) continue;

    // メッセージをやりとりする相手を最大2人選ぶ (保持ユーザーを優先、例: 50%)
    const partnerCount = Math.min(2, potentialPartners.length);
    const partners = [];
    const selectedUserIds = new Set<string>();
    const PRESERVED_PARTNER_PROBABILITY = 0.5;

    for (let i = 0; i < partnerCount && potentialPartners.length > selectedUserIds.size; i++) {
      let userToSelect: SeedUser | null = null;
      const availablePreserved = preservedPartners.filter((u) => !selectedUserIds.has(u.id));
      const availableOthers = otherPartners.filter((u) => !selectedUserIds.has(u.id));
      const availableAll = potentialPartners.filter((u) => !selectedUserIds.has(u.id));

      if (availablePreserved.length > 0 && faker.datatype.boolean(PRESERVED_PARTNER_PROBABILITY)) {
        userToSelect = faker.helpers.arrayElement(availablePreserved);
      } else if (availableOthers.length > 0) {
        userToSelect = faker.helpers.arrayElement(availableOthers);
      } else if (availableAll.length > 0) {
        userToSelect = faker.helpers.arrayElement(availableAll);
      }

      if (userToSelect) {
        partners.push(userToSelect);
        selectedUserIds.add(userToSelect.id);
      } else {
        break;
      }
    }

    // 各相手とメッセージをやり取り
    for (const partner of partners) {
      // partner は入札者または質問者
      // 質問リストと回答リストを定義 (以前のコードから)
      const bidderQuestionList = [
        "こちらの商品の状態について教えていただけますか？",
        "発送方法や配送にかかる日数はどれくらいでしょうか？",
        "他にも同様の商品を出品予定はありますか？",
        "この商品のサイズや重さなど、詳細を教えていただけますか？",
        "保証やサポートはありますか？",
        "商品の使用歴について教えていただけますか？",
        "支払いが完了した後、いつ頃発送される予定ですか？",
        "色や素材についてより詳しい情報はありますか？",
      ];
      const sellerAnswerList = [
        "商品は新品同様の状態です。目立った傷や汚れはありません。",
        "発送は落札後2-3営業日以内に行います。配送方法は商品説明に記載の通りです。",
        "現在のところ、同様の商品の出品予定はありません。",
        "詳細な情報は商品説明に記載していますが、不明点があればお気軽にお尋ねください。",
        "はい、メーカー保証が残っています。詳細は商品到着後にお伝えします。",
        "商品は数回使用しただけで、ほぼ新品の状態です。",
        "ご入金確認後、すぐに発送手続きを行います。通常は1-2営業日以内の発送となります。",
        "もちろんです。商品は黒色で素材は高品質なアルミニウムを使用しています。",
      ];

      try {
        const now = new Date();
        const messageBaseTime = faker.date.between({ from: auction.createdAt, to: now });

        // 1往復目
        const q1Time = faker.date.soon({ refDate: messageBaseTime, days: 1 });
        const bidderQuestion1 = await prisma.auctionMessage.create({
          data: {
            message: faker.helpers.arrayElement(bidderQuestionList),
            auctionId: auction.id,
            senderId: partner.id,
            recipientId: sellerId,
            createdAt: q1Time,
          },
        });
        messages.push(bidderQuestion1);

        const a1Time = faker.date.soon({ refDate: q1Time, days: 1 });
        const sellerAnswer1 = await prisma.auctionMessage.create({
          data: {
            message: faker.helpers.arrayElement(sellerAnswerList),
            auctionId: auction.id,
            senderId: sellerId,
            recipientId: partner.id,
            createdAt: a1Time,
          },
        });
        messages.push(sellerAnswer1);

        // 2往復目 (確率で発生)
        if (faker.datatype.boolean(0.7)) {
          const q2Time = faker.date.soon({ refDate: a1Time, days: 1 });
          const bidderQuestion2 = await prisma.auctionMessage.create({
            data: {
              message: faker.helpers.arrayElement(bidderQuestionList.filter((m) => m !== bidderQuestion1.message)),
              auctionId: auction.id,
              senderId: partner.id,
              recipientId: sellerId,
              createdAt: q2Time,
            },
          });
          messages.push(bidderQuestion2);

          const a2Time = faker.date.soon({ refDate: q2Time, days: 1 });
          const sellerAnswer2 = await prisma.auctionMessage.create({
            data: {
              message: faker.helpers.arrayElement(sellerAnswerList.filter((m) => m !== sellerAnswer1.message)),
              auctionId: auction.id,
              senderId: sellerId,
              recipientId: partner.id,
              createdAt: a2Time,
            },
          });
          messages.push(sellerAnswer2);
        }
      } catch (error) {
        console.error("オークションメッセージ作成エラー:", error);
      }
    }
  }

  console.log(`Created ${messages.length} auction messages`);
  return messages;
}

/**
 * メイン関数
 * シードデータを生成する全体の流れを制御します
 */
async function main() {
  try {
    console.log("シードデータの作成を開始します...");

    // 1. データベースの初期化
    await cleanupDatabase();

    // 2. ユーザー関連データの作成
    const users = await createUsers(SEED_CONFIG.USERS_COUNT);
    const accounts = await createAccounts(users);
    const sessions = await createSessions(users);
    const verificationTokens = await createVerificationTokens(SEED_CONFIG.VERIFICATION_TOKENS_COUNT);
    const userSettings = await createUserSettings(users);

    // 3. グループ関連データの作成
    const { groups, groupMemberships } = await createGroups(users);

    // 4. タスクデータの作成
    const tasks = await createTasks(SEED_CONFIG.TASKS_COUNT, groupMemberships, users);

    // 5. 分析データの作成
    const analytics = await createAnalytics(tasks, users);

    // 6. 通知データの作成
    const notifications = await createNotifications(users, groups, tasks, groupMemberships);

    // 7. オークション関連データの作成
    const auctions = await createAuctions(tasks, users);
    const bidHistories = await createBidHistories(auctions, users);
    const auctionMessages = await createAuctionMessages(auctions, users);
    const autoBids = await createAutoBids(auctions, users);
    const watchLists = await createTaskWatchLists(auctions, users);
    const auctionNotifications = await createAuctionNotifications(auctions, users);
    const auctionReviews = await createAuctionReviews(auctions);

    // 8. グループポイントデータの作成
    const groupPoints = await createGroupPoints(users, auctions);

    // 9. ポイント返還処理のシミュレーション
    const returnedPoints = await simulatePointReturn(auctions);

    // 10. 統計情報の表示
    console.log("-------------------------------------");
    console.log("シードデータ作成完了！");
    console.log("-------------------------------------");
    console.log(`ユーザー: ${users.length}名`);
    console.log(`アカウント: ${accounts.length}件`);
    console.log(`セッション: ${sessions.length}件`);
    console.log(`認証トークン: ${verificationTokens.length}件`);
    console.log(`ユーザー設定: ${userSettings.length}件`);
    console.log(`グループ: ${groups.length}件`);
    console.log(`グループメンバーシップ: ${groupMemberships.length}件`);
    console.log(`タスク: ${tasks.length}件`);
    console.log(`分析データ: ${analytics.length}件`);
    console.log(`通知: ${notifications.length + auctionNotifications.length}件`);
    console.log(`オークション: ${auctions.length}件`);
    console.log(`入札履歴: ${bidHistories.length}件`);
    console.log(`オークションメッセージ: ${auctionMessages.length}件`);
    console.log(`自動入札設定: ${autoBids.length}件`);
    console.log(`ウォッチリスト: ${watchLists.length}件`);
    console.log(`オークションレビュー: ${auctionReviews.length}件`);
    console.log(`グループポイント: ${groupPoints.length}件`);
    console.log(`ポイント返還: ${returnedPoints.length}件`);
    console.log("-------------------------------------");
  } catch (error) {
    console.error("シード作成エラー:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// プログラム実行
void main();

/**
 * ポイント返還処理のシミュレーション
 * 仕様書: オークション終了後、Group.depositPeriod日数後にポイントを返還
 * @param auctions 終了したオークション
 */
async function simulatePointReturn(auctions: SeedAuction[]) {
  console.log("Simulating point return process...");

  const returnedPoints = [];
  const now = new Date();

  // 終了済みのオークションのみを対象に
  const endedAuctions = auctions.filter((auction) => auction.status === AuctionStatus.ENDED && auction.winnerId);

  for (const auction of endedAuctions) {
    try {
      // グループの保管期間を取得
      const group = await prisma.group.findUnique({
        where: { id: auction.groupId },
        select: { depositPeriod: true },
      });

      if (!group) continue;

      // オークション終了日 + 保管期間が今日より前の場合、ポイント返還
      const returnDate = new Date(auction.endTime);
      returnDate.setDate(returnDate.getDate() + group.depositPeriod);

      // 一部のオークションで返還済みにするためにランダムフラグを使用
      const shouldReturn = faker.datatype.boolean(0.5); // 50%の確率で返還済みに

      if (shouldReturn && returnDate <= now && auction.winnerId) {
        // 落札履歴から入札額を取得
        const winningBid = await prisma.bidHistory.findFirst({
          where: {
            auctionId: auction.id,
            userId: auction.winnerId,
            status: BidStatus.WON,
          },
        });

        if (winningBid?.depositPoint) {
          // グループポイントを取得して更新
          const groupPoint = await prisma.groupPoint.findFirst({
            where: {
              userId: auction.winnerId,
              groupId: auction.groupId,
            },
          });

          if (groupPoint) {
            // ポイント返還処理
            await prisma.groupPoint.update({
              where: { id: groupPoint.id },
              data: {
                balance: {
                  increment: winningBid.depositPoint,
                },
              },
            });

            // タスク情報を取得
            const task = await prisma.task.findUnique({
              where: { id: auction.taskId },
              select: { task: true, deliveryMethod: true },
            });

            // ポイント返還通知を作成
            await prisma.notification.create({
              data: {
                title: generateNotificationTitle("POINT_RETURNED"),
                message: generateNotificationMessage(
                  "POINT_RETURNED",
                  auction,
                  { task: task?.task ?? "", deliveryMethod: task?.deliveryMethod, groupId: auction.groupId },
                  returnDate,
                ),
                targetType: "AUCTION_BIDDER",
                sendTimingType: "NOW", // 即時送信
                auctionEventType: "POINT_RETURNED",
                sendMethods: ["IN_APP"],
                senderUserId: null,
                auctionId: auction.id,
                isRead: { [auction.winnerId]: { isRead: false, readAt: null } }, // 修正: winnerId を使用して既読状態を設定
              },
            });

            returnedPoints.push({
              auctionId: auction.id,
              userId: auction.winnerId,
              amount: winningBid.depositPoint,
              returnDate,
            });
          }
        }
      }
    } catch (error) {
      console.error("ポイント返還処理エラー:", error);
    }
  }

  console.log(`Simulated ${returnedPoints.length} point returns`);
  return returnedPoints;
}
