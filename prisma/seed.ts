import type { JsonValue } from "@prisma/client/runtime/library";
import { faker } from "@faker-js/faker/locale/ja";
import { NotificationTargetType, NotificationType, PrismaClient, TaskStatus } from "@prisma/client";

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
const SEED_CONFIG = {
  USERS_COUNT: 10, // ユーザー数
  VERIFICATION_TOKENS_COUNT: 10, // 認証トークン数
  GROUPS_COUNT: 6, // グループ数
  MIN_MEMBERS_PER_GROUP: 3, // グループごとの最小メンバー数
  MAX_MEMBERS_PER_GROUP: 4, // グループごとの最大メンバー数
  TASKS_COUNT: 60, // タスク数
  NOTIFICATIONS_PER_USER: 10, // ユーザーごとの通知数
};

// 保持する固定ユーザーID
const PRESERVED_USER_IDS = ["cm91hfk750000g5u88pnoc4i4", "cm8odp55e0004mckyvhfo8ezy"];

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

type SeedTask = {
  id: string;
  task: string;
  detail?: string | null;
  reference?: string | null;
  category?: string | null;
  status: string;
  fixedContributionPoint?: number | null;
  fixedEvaluator?: string | null;
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
  extensionCount: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
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
  const groupsCount = Math.min(SEED_CONFIG.GROUPS_COUNT, users.length);

  // 保持されたユーザーをグループ作成者に含める
  const preservedUsers = users.filter((user) => PRESERVED_USER_IDS.includes(user.id));
  const otherUsers = users.filter((user) => !PRESERVED_USER_IDS.includes(user.id));

  // 作成者用のユーザーリストを作成（保持ユーザーを先頭に）
  const creatorUsers = [...preservedUsers, ...faker.helpers.shuffle(otherUsers)];

  for (let i = 0; i < groupsCount; i++) {
    // 循環的にユーザーを選択（保持されたユーザーが必ず含まれるようにインデックスを調整）
    const creatorUser = creatorUsers[i % creatorUsers.length];

    // ポイント預け入れ期間を生成（7〜90日の範囲）
    const depositPeriod = faker.number.int({ min: 7, max: 90 });

    const group = await prisma.group.create({
      data: {
        name: `${faker.company.name()} グループ ${i + 1}`,
        goal: faker.company.catchPhrase(),
        evaluationMethod: faker.helpers.arrayElement(evaluationMethods),
        maxParticipants: faker.number.int({ min: 5, max: 20 }),
        depositPeriod: depositPeriod, // ポイント預け入れ期間を設定
        createdBy: creatorUser.id,
        isBlackList: {}, // 空のJSONオブジェクトとして初期化
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

  // 各グループにランダムな数のメンバーを追加
  for (const group of groups) {
    // 保持されたユーザーを優先的に追加
    const preservedUsers = users.filter((user) => preservedUserIds.has(user.id));

    // 保持されたユーザー以外をシャッフル
    const otherUsers = faker.helpers.shuffle(users.filter((user) => !preservedUserIds.has(user.id)));

    // グループに追加するメンバー数を決定（最小値は保持されたユーザー数+1以上）
    const numMembers = faker.number.int({
      min: Math.max(minMembersPerGroup, preservedUsers.length),
      max: Math.min(maxMembersPerGroup, users.length),
    });

    // 先に保持されたユーザーをすべて追加
    const usersToAdd = [...preservedUsers];

    // 残りは他のユーザーから追加
    const remainingCount = numMembers - usersToAdd.length;
    if (remainingCount > 0) {
      usersToAdd.push(...otherUsers.slice(0, remainingCount));
    }

    // メンバーシップを作成
    for (const user of usersToAdd) {
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
            joinedAt: faker.date.recent(),
            isGroupOwner, // グループオーナー権限を設定
          },
        });
        memberships.push(membership);
      }
    }
  }

  console.log(`${memberships.length}件のグループメンバーシップを作成しました`);
  return memberships;
}

// constants.tsのAUCTION_CATEGORIESと同様のカテゴリを定義
const TASK_CATEGORIES = ["食品", "コード", "本", "デザイン", "開発", "マーケティング", "ライティング", "事務作業", "その他"];

// 提供方法のリスト（タスクに既に設定されていない場合のデフォルト）
const DELIVERY_METHODS = ["Amazonのほしい物リスト", "GitHubスポンサー", "直接発送（着払い）", "オンラインコード送信", "オンラインミーティング", "チャットでの情報提供", "メールでのデータ送信"];

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
  const taskStatuses = Object.values(TaskStatus);

  for (let i = 0; i < count; i++) {
    // ランダムにメンバーシップを選択
    const membership = faker.helpers.arrayElement(groupMemberships);
    const creator = users.find((u) => u.id === membership.userId) ?? faker.helpers.arrayElement(users);
    const groupId = membership.groupId;

    // タスクの詳細を生成
    const taskTitle = faker.company.catchPhrase();
    const taskStatus = faker.helpers.arrayElement(taskStatuses);

    // ランダムにカテゴリを選択
    const category = faker.helpers.arrayElement(TASK_CATEGORIES);

    // 評価者と評価ロジック (50%の確率で設定)
    const hasEvaluator = faker.datatype.boolean(0.5);
    const fixedEvaluator = hasEvaluator ? faker.helpers.arrayElement(users).id : null;
    const fixedEvaluationLogic = hasEvaluator ? faker.lorem.paragraph(1) : null;

    // 固定貢献ポイント (1-100)
    const fixedPoints = faker.number.int({ min: 1, max: 100 });

    // 証拠・結果・補足情報を生成 (70%の確率で設定)
    const hasInfo = faker.datatype.boolean(0.7);
    let info = null;
    if (hasInfo) {
      // 情報のタイプをランダムに選択（3種類のうちの1つ）
      const infoType = faker.helpers.arrayElement(["pullrequest", "achievement", "explanation"]);

      switch (infoType) {
        case "pullrequest":
          // GitHub PRのURLを生成
          const repoName = faker.helpers.arrayElement(["project-x", "web-app", "api-service", "ui-components", "docs"]);
          const orgName = faker.helpers.arrayElement(["acme", "company", "team", "dev-group", "open-source"]);
          const prNumber = faker.number.int({ min: 1, max: 999 });
          info = `プルリクエスト: https://github.com/${orgName}/${repoName}/pull/${prNumber}`;
          break;
        case "achievement":
          // 成果物や達成したことの説明
          const metric = faker.helpers.arrayElement(["パフォーマンス", "ユーザー数", "処理速度", "コード品質", "テストカバレッジ"]);
          const improvement = faker.number.int({ min: 5, max: 95 });
          info = `${metric}が${improvement}%向上しました。詳細: ${faker.internet.url()}`;
          break;
        case "explanation":
          // 補足説明
          info = faker.lorem.paragraph(2);
          break;
      }
    }

    // TaskReporterとTaskExecutorの準備
    // 報告者の数 (1〜3人)
    const reportersCount = faker.number.int({ min: 1, max: 3 });
    const reporters = [];

    for (let j = 0; j < reportersCount; j++) {
      // 登録ユーザーか非登録ユーザーかを決定 (70%の確率で登録ユーザー)
      const isRegisteredUser = faker.datatype.boolean(0.7);

      if (isRegisteredUser) {
        // 登録ユーザーの場合
        const reporter = faker.helpers.arrayElement(users);
        reporters.push({
          name: reporter.name,
          userId: reporter.id,
        });
      } else {
        // 非登録ユーザーの場合
        reporters.push({
          name: faker.person.fullName(),
        });
      }
    }

    // 実行者の数 (1〜3人)
    const executorsCount = faker.number.int({ min: 1, max: 3 });
    const executors = [];

    for (let j = 0; j < executorsCount; j++) {
      // 登録ユーザーか非登録ユーザーかを決定 (70%の確率で登録ユーザー)
      const isRegisteredUser = faker.datatype.boolean(0.7);

      if (isRegisteredUser) {
        // 登録ユーザーの場合
        const executor = faker.helpers.arrayElement(users);
        executors.push({
          name: executor.name,
          userId: executor.id,
        });
      } else {
        // 非登録ユーザーの場合
        executors.push({
          name: faker.person.fullName(),
        });
      }
    }

    // 出品タイプの場合は提供方法を設定（カテゴリに合わせた提供方法）
    const isReward = faker.datatype.boolean(0.4); // 40%の確率で報酬タスク
    const contributionType = isReward ? "REWARD" : "NON_REWARD";

    // カテゴリに応じた提供方法を選択（報酬タイプの場合のみ）
    let deliveryMethod = null;
    if (isReward) {
      const categoryMethods = CATEGORY_DELIVERY_METHODS[category] || DELIVERY_METHODS;
      deliveryMethod = faker.helpers.arrayElement(categoryMethods);
    }

    // タスク作成
    const task = await prisma.task.create({
      data: {
        task: taskTitle,
        detail: faker.lorem.paragraph(),
        reference: faker.datatype.boolean(0.3) ? faker.internet.url() : null,
        category,
        status: taskStatus,
        fixedContributionPoint: fixedPoints,
        fixedEvaluator,
        fixedEvaluationLogic,
        info,
        contributionType,
        deliveryMethod,
        creatorId: creator.id,
        userFixedSubmitterId: faker.datatype.boolean(0.3) ? faker.helpers.arrayElement(users).id : null,
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

  // 完了したタスクのみ分析対象とする（一部のタスクのみ評価対象とする）
  const completedTasks = tasks.filter((task) => ["TASK_COMPLETED", "FIXED_EVALUATED", "POINTS_AWARDED"].includes(task.status));

  console.log(`${completedTasks.length}件の完了タスクから分析データを作成します`);

  // 完了タスクごとに複数の分析データを作成する可能性があるため、ランダムに評価回数を決定
  for (const task of completedTasks) {
    // タスクごとに1〜3件の評価データを作成
    const evaluationsCount = faker.number.int({ min: 1, max: 3 });

    for (let i = 0; i < evaluationsCount; i++) {
      // ランダムな評価者を選択（タスク作成者以外から選ぶのが望ましい）
      const potentialEvaluators = users.filter((user) => user.id !== task.userId);
      const evaluator = faker.helpers.arrayElement(potentialEvaluators).id;

      // 貢献ポイントは1〜100の範囲でランダムに設定
      // タスクに固定貢献ポイントがある場合は、その周辺の値を使用
      const basePoint = task.fixedContributionPoint ?? faker.number.int({ min: 10, max: 50 });
      const variation = faker.number.int({ min: -5, max: 10 });
      const contributionPoint = Math.max(1, Math.min(100, basePoint + variation));

      // 評価ロジックのサンプル文を生成
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

      // ランダムな評価理由を2〜3個選択して評価ロジックを作成
      const selectedReasons = faker.helpers.arrayElements(evaluationReasons, faker.number.int({ min: 2, max: 3 }));
      const evaluationLogic = selectedReasons.join("。") + "。";

      // 分析データを作成
      const analytic = await prisma.analytics.create({
        data: {
          taskId: task.id,
          groupId: task.groupId,
          evaluator,
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
 * 通知データを生成する関数
 * @param users ユーザーの配列
 * @param groups グループの配列
 * @param tasks タスクの配列
 * @returns 生成された通知の配列
 */
async function createNotifications(users: SeedUser[], groups: SeedGroup[], tasks: SeedTask[]) {
  const notifications = [];
  const notificationTypes = Object.values(NotificationType);
  const targetTypes = Object.values(NotificationTargetType);

  // 保持されたユーザーを取得
  const preservedUsers = users.filter((user) => PRESERVED_USER_IDS.includes(user.id));
  const otherUsers = users.filter((user) => !PRESERVED_USER_IDS.includes(user.id));

  // ユーザー配列を作成（保持ユーザーを先頭に）
  const allUsers = [...preservedUsers, ...otherUsers];

  // 各ユーザーに対して通知を生成
  for (const user of allUsers) {
    // ユーザーごとの通知数を決定（保持されたユーザーは必ず最大数の通知を生成）
    const isPreservedUser = PRESERVED_USER_IDS.includes(user.id);
    const notificationCount = isPreservedUser
      ? SEED_CONFIG.NOTIFICATIONS_PER_USER
      : faker.number.int({
          min: 1,
          max: SEED_CONFIG.NOTIFICATIONS_PER_USER,
        });

    for (let i = 0; i < notificationCount; i++) {
      // 通知の基本情報を生成
      const notificationType = faker.helpers.arrayElement(notificationTypes);
      const targetType = faker.helpers.arrayElement(targetTypes);

      // 生成から現在までの時間をランダムに設定（過去の通知を表現）
      const daysPast = faker.number.int({ min: 0, max: 30 });
      const hoursPast = faker.number.int({ min: 0, max: 23 });
      const minutesPast = faker.number.int({ min: 0, max: 59 });

      const sentAt = new Date();
      sentAt.setDate(sentAt.getDate() - daysPast);
      sentAt.setHours(sentAt.getHours() - hoursPast);
      sentAt.setMinutes(sentAt.getMinutes() - minutesPast);

      // 通知タイプに応じたタイトルとメッセージを生成
      let title, message, actionUrl;
      let groupId = null;
      let taskId = null;

      switch (targetType) {
        case "SYSTEM":
          title = faker.helpers.arrayElement(["システムメンテナンス情報", "重要なお知らせ", "アップデート情報", "サービス改善のお知らせ"]);
          message = faker.lorem.paragraph();
          break;

        case "USER":
          title = faker.helpers.arrayElement(["アカウント情報の更新", "プロフィール確認のお願い", "個人設定の変更", "ログイン情報の確認"]);
          message = `${user.name}様、${faker.lorem.sentence()}`;
          break;

        case "GROUP":
          // グループを選択（保持されたユーザーが所属するグループを優先）
          let randomGroup;
          if (isPreservedUser && i < groups.length) {
            // 保持されたユーザーが所属するグループを選ぶ
            const userGroups = groups.filter((g) => g.createdBy === user.id || tasks.some((t) => t.groupId === g.id && t.userId === user.id));
            randomGroup = userGroups.length > 0 ? faker.helpers.arrayElement(userGroups) : faker.helpers.arrayElement(groups);
          } else {
            randomGroup = faker.helpers.arrayElement(groups);
          }

          groupId = randomGroup.id;
          title = faker.helpers.arrayElement([`「${randomGroup.name}」の新着情報`, `「${randomGroup.name}」からのお知らせ`, `「${randomGroup.name}」メンバー募集`, `「${randomGroup.name}」活動報告`]);
          message = faker.lorem.paragraph();
          actionUrl = `/dashboard/group/${randomGroup.id}`;
          break;

        case "TASK":
          // タスクを選択（保持されたユーザーのタスクを優先）
          let randomTask;
          if (isPreservedUser && tasks.some((t) => t.userId === user.id)) {
            // 保持されたユーザーのタスクから選ぶ
            const userTasks = tasks.filter((t) => t.userId === user.id);
            randomTask = userTasks.length > 0 ? faker.helpers.arrayElement(userTasks) : faker.helpers.arrayElement(tasks);
          } else {
            randomTask = faker.helpers.arrayElement(tasks);
          }

          taskId = randomTask.id;
          groupId = randomTask.groupId;
          title = faker.helpers.arrayElement([`タスク「${randomTask.task.substring(0, 20)}...」の更新`, `タスク期限のお知らせ`, `タスク評価の完了`, `タスク状態の変化`]);
          message = faker.lorem.paragraph();
          actionUrl = `/dashboard/tasks/${randomTask.id}`;
          break;
      }

      // 通知期限（オプション、一部の通知のみ）
      const hasExpiry = faker.datatype.boolean(0.3); // 30%の確率で期限あり
      let expiresAt = null;
      if (hasExpiry) {
        const daysToExpiry = faker.number.int({ min: 1, max: 60 });
        expiresAt = new Date(sentAt);
        expiresAt.setDate(expiresAt.getDate() + daysToExpiry);
      }

      // 通知の優先度（1-5）
      const priority = faker.number.int({ min: 1, max: 5 });

      // 既読状態のJSONBデータを生成
      // 保持されたユーザーは必ず既読状態を持つようにする
      const isReadJsonb: Record<string, { isRead: boolean; readAt: string | null }> = {};

      // 送信者（user）は常に既読状態を持つようにする
      const senderIsRead = faker.datatype.boolean(0.8); // 80%の確率で既読
      let senderReadAt = null;
      if (senderIsRead) {
        // 送信時間から現在までの間のランダムな時間を既読時間とする
        const readDate = new Date(sentAt);
        const minutesAfterSent = faker.number.int({ min: 1, max: 60 * 24 * 3 }); // 最大3日後
        readDate.setMinutes(readDate.getMinutes() + minutesAfterSent);
        senderReadAt = readDate.toISOString();
      }
      isReadJsonb[user.id] = { isRead: senderIsRead, readAt: senderReadAt };

      // 保持されたユーザーの既読状態を追加（送信者が保持されたユーザーでない場合）
      if (!isPreservedUser) {
        for (const preservedUser of preservedUsers) {
          // ユーザーIDが異なる場合のみ追加
          if (preservedUser.id !== user.id) {
            const isRead = faker.datatype.boolean(0.6); // 60%の確率で既読
            let readAt = null;
            if (isRead) {
              // 送信時間から現在までの間のランダムな時間を既読時間とする
              const readDate = new Date(sentAt);
              const minutesAfterSent = faker.number.int({ min: 1, max: 60 * 24 * 3 }); // 最大3日後
              readDate.setMinutes(readDate.getMinutes() + minutesAfterSent);
              readAt = readDate.toISOString();
            }
            isReadJsonb[preservedUser.id] = { isRead, readAt };
          }
        }
      }

      // 他のランダムなユーザーの既読状態を追加
      const readStatusCount = faker.number.int({ min: 0, max: 3 });
      const readStatusUsers = faker.helpers.arrayElements(
        users.filter((u) => !PRESERVED_USER_IDS.includes(u.id) && u.id !== user.id),
        readStatusCount,
      );

      for (const readUser of readStatusUsers) {
        const isRead = faker.datatype.boolean(0.6); // 60%の確率で既読
        let readAt = null;
        if (isRead) {
          // 送信時間から現在までの間のランダムな時間を既読時間とする
          const readDate = new Date(sentAt);
          const minutesAfterSent = faker.number.int({ min: 1, max: 60 * 24 * 3 }); // 最大3日後
          readDate.setMinutes(readDate.getMinutes() + minutesAfterSent);
          readAt = readDate.toISOString();
        }

        isReadJsonb[readUser.id] = { isRead, readAt };
      }

      // 通知をデータベースに追加
      try {
        // JSONB型のカラムはPrismaのJSON型として保存
        // Prismaの型定義に合わせた通知データの型を定義
        type NotificationData = {
          title: string;
          message: string;
          type: string;
          targetType: string;
          priority: number;
          sentAt: Date;
          expiresAt: Date | null;
          actionUrl?: string | null;
          userId: string;
          groupId?: string | null;
          taskId?: string | null;
          isRead: Record<string, { isRead: boolean; readAt: string | null }>;
        };

        const notificationData: NotificationData = {
          title,
          message,
          type: notificationType,
          targetType,
          priority,
          sentAt,
          expiresAt,
          actionUrl,
          userId: user.id,
          groupId,
          taskId,
          isRead: isReadJsonb,
        };

        // Prismaのスキーマに合わせて必要なプロパティのみを抽出して型安全に渡す
        const notification = await prisma.notification.create({
          data: {
            title: notificationData.title,
            message: notificationData.message,
            type: notificationData.type as NotificationType,
            targetType: notificationData.targetType as NotificationTargetType,
            priority: notificationData.priority,
            sentAt: notificationData.sentAt,
            expiresAt: notificationData.expiresAt,
            actionUrl: notificationData.actionUrl,
            userId: notificationData.userId,
            groupId: notificationData.groupId,
            taskId: notificationData.taskId,
            isRead: isReadJsonb, // Prismaの型定義とJSONBの互換性問題に対応
          },
        });

        notifications.push(notification);
      } catch (error) {
        console.error("通知作成エラー:", error);

        // JSONB型がサポートされていない場合は、rawクエリで対応
        if (error instanceof Error && error.message.includes("JsonB")) {
          const id = faker.string.uuid();

          try {
            const result = await prisma.$executeRaw`
              INSERT INTO "Notification" (
                "id", "title", "message", "type", "targetType", "priority", 
                "sentAt", "expiresAt", "actionUrl", "userId", "groupId", "taskId", "isRead"
              ) VALUES (
                ${id}, ${title}, ${message}, ${notificationType}, ${targetType}, ${priority}, 
                ${sentAt}, ${expiresAt}, ${actionUrl}, ${user.id}, ${groupId}, ${taskId}, 
                ${JSON.stringify(isReadJsonb)}::jsonb
              )
            `;
            if (result) {
              notifications.push({
                id,
                title,
                message,
                type: notificationType,
                targetType,
                priority,
                sentAt,
                expiresAt,
                actionUrl,
                userId: user.id,
                groupId,
                taskId,
                isRead: isReadJsonb,
              });
            }
          } catch (rawError) {
            console.error("Raw SQLエラー:", rawError);
          }
        }
      }
    }
  }

  console.log(`${notifications.length}件の通知を作成しました`);
  return { notifications, notificationReadStatuses: [] };
}

// オークションの生成
async function createAuctions(tasks: SeedTask[], users: SeedUser[]): Promise<SeedAuction[]> {
  console.log("Creating auctions...");

  const auctions: SeedAuction[] = [];

  // タスクから報酬タイプのタスクのみ抽出（contributionType が "REWARD" のもの）
  const rewardTasks = tasks.filter((task) => task.contributionType === "REWARD");

  // 報酬タスクが少ない場合は、追加の報酬タスクを作成
  if (rewardTasks.length < 15) {
    console.log(`報酬タスクが少ないため、NON_REWARDタスクからいくつかを変換します`);
    const nonRewardTasks = tasks.filter((task) => task.contributionType === "NON_REWARD");
    const tasksToConvert = faker.helpers.arrayElements(nonRewardTasks, Math.min(nonRewardTasks.length, 15 - rewardTasks.length));

    for (const task of tasksToConvert) {
      // カテゴリを確認
      const category = task.category ?? "その他";
      // カテゴリに合った提供方法を選択
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
    // 開始時間と終了時間の設定（現在から過去7日〜未来14日の範囲）
    const now = new Date();
    const startTimeOffset = faker.number.int({ min: -7 * 24 * 60 * 60 * 1000, max: 7 * 24 * 60 * 60 * 1000 });
    const startTime = new Date(now.getTime() + startTimeOffset);

    // 終了時間は開始時間から1日〜7日後
    const endTimeOffset = faker.number.int({ min: 24 * 60 * 60 * 1000, max: 7 * 24 * 60 * 60 * 1000 });
    const endTime = new Date(startTime.getTime() + endTimeOffset);

    // 開始価格は500〜5000ポイントの範囲で設定
    const initialPrice = faker.number.int({ min: 500, max: 5000 });

    // オークションの状態を決定（開始前、進行中、終了済み）
    let status: "PENDING" | "ACTIVE" | "ENDED" | "CANCELED";
    if (startTime > now) {
      status = "PENDING"; // 開始前
    } else if (endTime > now) {
      status = "ACTIVE"; // 進行中
    } else {
      status = "ENDED"; // 終了済み
    }

    // 現在の最高入札額を設定（初期値は開始価格）
    let currentHighestBid = initialPrice;
    let currentHighestBidderId = null;

    // 入札者がいる場合に備えて、ランダムな最高入札者を選択
    if (status === "ACTIVE" || status === "ENDED") {
      // 入札できるユーザーはタスク作成者以外
      const potentialBidders = users.filter((user) => user.id !== task.creatorId);
      if (potentialBidders.length > 0) {
        // 入札があるかどうかをランダムに決定
        const hasBids = faker.datatype.boolean();
        if (hasBids) {
          // 最高入札者を設定
          const highestBidder = faker.helpers.arrayElement(potentialBidders);
          currentHighestBidderId = highestBidder.id;

          // 最高入札額は開始価格の10%〜50%増し
          const bidIncrease = initialPrice * (0.1 + faker.number.float({ min: 0, max: 0.4 }));
          currentHighestBid = Math.floor(initialPrice + bidIncrease);
        }
      }
    }

    // 落札者を設定（終了済みの場合のみ）
    let winnerId = null;
    if (status === "ENDED" && currentHighestBidderId) {
      // 最高入札者がいる場合は落札者として設定
      winnerId = currentHighestBidderId;
    }

    // タスクの情報を取得して、既存の提供方法を確認
    let deliveryMethod = task.deliveryMethod;

    // 提供方法が未設定の場合、カテゴリに応じた提供方法をランダムに選択
    if (!deliveryMethod) {
      const category = task.category ?? "その他";
      const categoryMethods = CATEGORY_DELIVERY_METHODS[category] ?? DELIVERY_METHODS;
      deliveryMethod = faker.helpers.arrayElement(categoryMethods);

      // タスク情報に提供方法を更新
      await prisma.task.update({
        where: { id: task.id },
        data: {
          deliveryMethod,
        },
      });
    }

    const auction = await prisma.auction.create({
      data: {
        taskId: task.id,
        currentHighestBid,
        currentHighestBidderId,
        winnerId,
        startTime,
        endTime,
        status,
        createdAt: new Date(startTime.getTime() - faker.number.int({ min: 1, max: 48 }) * 60 * 60 * 1000),
      },
    });

    auctions.push(auction);
  }

  console.log(`Created ${auctions.length} auctions`);
  return auctions;
}

// 入札履歴の生成
async function createBidHistories(auctions: SeedAuction[], users: SeedUser[]) {
  console.log("Creating bid histories...");

  const bidHistories = [];

  for (const auction of auctions) {
    // 開始前のオークションはスキップ
    if (auction.status === "PENDING") continue;

    // 関連するタスクを取得
    const task = await prisma.task.findUnique({
      where: { id: auction.taskId },
      select: { creatorId: true },
    });

    if (!task) continue;

    // タスク作成者以外のユーザーを入札者候補として抽出
    const potentialBidders = users.filter((user) => user.id !== task.creatorId);
    if (potentialBidders.length === 0) continue;

    // 入札数を0〜10の範囲でランダムに決定
    const bidCount = auction.status === "ENDED" ? faker.number.int({ min: 1, max: 10 }) : faker.number.int({ min: 0, max: 10 });

    if (bidCount === 0) continue;

    // 入札履歴の生成（最古の入札から最新の入札まで）
    let currentBid = auction.currentHighestBid;
    const bidTimeRange = auction.endTime.getTime() - auction.startTime.getTime();
    const bidTimes = Array(bidCount)
      .fill(0)
      .map(() => new Date(auction.startTime.getTime() + faker.number.float() * bidTimeRange))
      .sort((a, b) => a.getTime() - b.getTime());

    for (let i = 0; i < bidCount; i++) {
      const bidder = faker.helpers.arrayElement(potentialBidders);

      // 入札額は前回の入札額の1%〜10%増し
      const bidIncrease = currentBid * (0.01 + faker.number.float({ min: 0, max: 0.09 }));
      currentBid = Math.floor(currentBid + bidIncrease);

      // 自動入札かどうかをランダムに決定
      const isAutoBid = faker.datatype.boolean(0.3); // 30%の確率で自動入札

      const bid = await prisma.bidHistory.create({
        data: {
          auctionId: auction.id,
          userId: bidder.id,
          amount: currentBid,
          isAutoBid,
          createdAt: bidTimes[i],
          status: "BIDDING", // BIDDINGがBidStatusの有効な値
        },
      });

      bidHistories.push(bid);
    }

    // 最終的な最高入札額でオークションを更新
    if (bidHistories.length > 0) {
      const highestBid = bidHistories.filter((bid) => bid.auctionId === auction.id).sort((a, b) => b.amount - a.amount)[0];

      if (highestBid) {
        await prisma.auction.update({
          where: { id: auction.id },
          data: {
            currentHighestBid: highestBid.amount,
            currentHighestBidderId: highestBid.userId,
          },
        });
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
  const activeAuctions = auctions.filter((auction) => auction.status === "ACTIVE");

  for (const auction of activeAuctions) {
    // 関連するタスクを取得
    const task = await prisma.task.findUnique({
      where: { id: auction.taskId },
      select: { creatorId: true },
    });

    if (!task) continue;

    // タスク作成者以外のユーザーを候補として抽出
    const potentialUsers = users.filter((user) => user.id !== task.creatorId);
    if (potentialUsers.length === 0) continue;

    // 自動入札設定を持つユーザー数（0〜3人）
    const autoBidUserCount = faker.number.int({ min: 0, max: 3 });
    if (autoBidUserCount === 0) continue;

    // ランダムにユーザーを選択
    const autoBidUsers = faker.helpers.arrayElements(potentialUsers, autoBidUserCount);

    for (const user of autoBidUsers) {
      // 自動入札の最大金額は現在の最高入札額の10%〜100%増し
      const maxBidAmount = Math.floor(auction.currentHighestBid * (1.1 + faker.number.float({ min: 0, max: 0.9 })));
      // 入札単位は10〜200の範囲でランダム
      const bidIncrement = faker.number.int({ min: 10, max: 200 });

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

// オークション通知の生成
async function createAuctionNotifications(auctions: SeedAuction[], users: SeedUser[]) {
  console.log("Creating auction notifications...");

  const notifications = [];

  // 各ユーザーに対して通知を生成
  for (const user of users) {
    // ユーザーが関わっているオークション（高額入札または落札）
    const relevantAuctions = auctions.filter((auction) => auction.currentHighestBidderId === user.id || auction.winnerId === user.id);

    if (relevantAuctions.length === 0) continue;

    // 各オークションに対して0〜3件の通知を生成
    for (const auction of relevantAuctions) {
      const notificationCount = faker.number.int({ min: 1, max: 3 }); // 最低1件は通知を生成

      // 通知タイプのリスト (Prismaのスキーマに合わせる)
      let notificationTypes: ("BID_PLACED" | "OUTBID" | "QUESTION_RECEIVED" | "MAX_BID_REACHED" | "AUCTION_ENDED" | "WON_AUCTION" | "LOST_AUCTION" | "POINT_RETURNED")[] = [
        "BID_PLACED",
        "OUTBID",
        "AUCTION_ENDED",
      ];

      // 落札者の場合
      if (auction.winnerId === user.id) {
        notificationTypes = ["WON_AUCTION", "POINT_RETURNED"];
      }
      // 最高入札者だが落札者ではない場合
      else if (auction.currentHighestBidderId === user.id && auction.status === "ENDED" && auction.winnerId !== user.id) {
        notificationTypes = ["LOST_AUCTION", "POINT_RETURNED"];
      }

      for (let i = 0; i < notificationCount; i++) {
        // ランダムな通知タイプを選択
        const notificationType = faker.helpers.arrayElement(notificationTypes);

        // 既読状態をランダムに決定
        const isRead = faker.datatype.boolean(0.6); // 60%の確率で既読

        // 通知の作成日時と有効期限（過去1週間以内の通知で、30日後に期限切れ）
        const createdAt = new Date(new Date().getTime() - faker.number.int({ min: 1, max: 7 * 24 }) * 60 * 60 * 1000);
        const expiresAt = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);

        // 関連するタスク情報を取得
        const task = await prisma.task.findUnique({
          where: { id: auction.taskId },
          select: {
            task: true,
            deliveryMethod: true,
          },
        });

        // 預けたポイントが返ってくる期間（落札日の2ヶ月後）
        let pointReturnDate = null;
        if (auction.status === "ENDED" && auction.winnerId) {
          const twoMonthsLater = new Date(auction.endTime);
          twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2);
          pointReturnDate = twoMonthsLater;
        }

        try {
          const notification = await prisma.auctionNotification.create({
            data: {
              user: { connect: { id: user.id } },
              auction: { connect: { id: auction.id } },
              title: generateNotificationTitle(notificationType),
              message: generateNotificationMessage(notificationType, auction, task, pointReturnDate),
              type: notificationType,
              isRead,
              createdAt,
              expiresAt,
            },
          });

          notifications.push(notification);
        } catch (error) {
          console.error(`通知作成エラー (タイプ: ${notificationType}):`, error);
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
    case "BID_PLACED":
      return "入札完了";
    case "OUTBID":
      return "入札が上回られました";
    case "AUCTION_ENDED":
      return "オークション終了";
    case "WON_AUCTION":
      return "オークション落札成功";
    case "LOST_AUCTION":
      return "オークション落札失敗";
    case "POINT_RETURNED":
      return "ポイント返還予定のお知らせ";
    default:
      return "オークション通知";
  }
}

// 通知メッセージの生成ヘルパー関数
function generateNotificationMessage(type: string, auction: SeedAuction, task?: { task?: string; deliveryMethod?: string | null } | null, pointReturnDate?: Date | null): string {
  const taskTitle = task?.task ? task.task.substring(0, 30) + (task.task.length > 30 ? "..." : "") : "商品";
  const deliveryMethod = task?.deliveryMethod ?? "未定";
  const bidAmount = auction.currentHighestBid.toLocaleString();

  switch (type) {
    case "BID_PLACED":
      return `「${taskTitle}」のオークションに${bidAmount}ポイントで入札しました。`;
    case "OUTBID":
      return `「${taskTitle}」のオークションで、あなたの入札が他のユーザーに上回られました。再入札を検討してください。`;
    case "AUCTION_ENDED":
      return `「${taskTitle}」のオークションが終了しました。結果を確認してください。`;
    case "WON_AUCTION":
      if (pointReturnDate) {
        const formattedDate = pointReturnDate.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
        return `おめでとうございます！「${taskTitle}」を${bidAmount}ポイントで落札しました。提供方法は「${deliveryMethod}」です。\n預けたポイントは${formattedDate}に返還される予定です。`;
      }
      return `おめでとうございます！「${taskTitle}」を${bidAmount}ポイントで落札しました。提供方法は「${deliveryMethod}」です。`;
    case "LOST_AUCTION":
      return `残念ながら「${taskTitle}」のオークションで落札できませんでした。入札したポイントは返還されました。`;
    case "POINT_RETURNED":
      if (pointReturnDate) {
        const formattedDate = pointReturnDate.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
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
  const endedAuctions = auctions.filter((auction) => auction.status === "ENDED" && auction.winnerId !== null);

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

    // レビューが存在する確率（80%）
    const hasReview = faker.datatype.boolean(0.8);
    if (!hasReview) continue;

    // 売り手（タスク作成者）から買い手（落札者）へのレビュー
    try {
      // 完了証明URLの生成（40%の確率で存在）
      const hasProofUrl = faker.datatype.boolean(0.4);
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
          rating: faker.number.int({ min: 3, max: 5 }), // 売り手からは比較的高評価
          comment: faker.helpers.arrayElement(sellerReviewComments),
          completionProofUrl,
          isSellerReview: true,
          createdAt: new Date(auction.endTime.getTime() + faker.number.int({ min: 1, max: 7 * 24 }) * 60 * 60 * 1000),
        },
      });

      reviews.push(sellerReview);
    } catch (error) {
      console.error("売り手レビュー作成エラー:", error);
    }

    // 買い手から売り手へのレビュー（90%の確率で存在）
    const hasBuyerToSellerReview = faker.datatype.boolean(0.9);
    if (hasBuyerToSellerReview) {
      try {
        // 完了証明URLの生成（30%の確率で存在）
        const hasProofUrl = faker.datatype.boolean(0.3);
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
            rating: faker.number.int({ min: 2, max: 5 }), // 買い手からの評価は若干ばらつきがある
            comment: faker.helpers.arrayElement(buyerReviewComments),
            completionProofUrl,
            isSellerReview: false,
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

  // すべてのオークションに対して処理
  for (const auction of auctions) {
    // 関連するタスクを取得
    const task = await prisma.task.findUnique({
      where: { id: auction.taskId },
      select: { creatorId: true },
    });

    if (!task) continue;

    // タスク作成者以外のユーザーを対象に
    const potentialWatchers = users.filter((user) => user.id !== task.creatorId);
    if (potentialWatchers.length === 0) continue;

    // ウォッチリストに追加するユーザー数（0〜5人）
    const watcherCount = faker.number.int({ min: 0, max: 5 });
    if (watcherCount === 0) continue;

    // ランダムにウォッチするユーザーを選択
    const watchers = faker.helpers.arrayElements(potentialWatchers, watcherCount);

    for (const watcher of watchers) {
      try {
        // 日付の比較: auction.createdAtが現在時刻より後の場合、調整する
        const now = new Date();
        const fromDate = new Date(auction.createdAt);
        const toDate = now;

        // fromがtoより後の場合、fromをtoよりも前に調整
        if (fromDate > toDate) {
          // 現在時刻から過去24時間以内でランダムな時間を設定
          const createdAtTime = new Date(now.getTime() - faker.number.int({ min: 0, max: 24 * 60 * 60 * 1000 }));

          const watchList = await prisma.taskWatchList.create({
            data: {
              userId: watcher.id,
              auctionId: auction.id,
              createdAt: createdAtTime,
            },
          });

          watchLists.push(watchList);
        } else {
          // 通常通り処理
          const watchList = await prisma.taskWatchList.create({
            data: {
              userId: watcher.id,
              auctionId: auction.id,
              createdAt: new Date(
                faker.date.between({
                  from: fromDate,
                  to: toDate,
                }),
              ),
            },
          });

          watchLists.push(watchList);
        }
      } catch (error) {
        // ユニーク制約に違反した場合はスキップ
        if (error instanceof Error && error.message.includes("Unique constraint")) {
          console.log(`ユーザー ${watcher.id} は既にオークション ${auction.id} をウォッチリストに追加済みです`);
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
      let balance = faker.number.int({ min: 100, max: 10000 });
      const fixedTotalPoints = balance;

      // ユーザーが落札者であるオークションを取得
      const wonAuctions = auctions.filter((auction) => auction.winnerId === user.id && auction.status === "ENDED");

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
    const { notifications, notificationReadStatuses } = await createNotifications(users, groups, tasks);

    // 7. オークション関連データの作成
    const auctions = await createAuctions(tasks, users);
    const bidHistories = await createBidHistories(auctions, users);
    const autoBids = await createAutoBids(auctions, users);
    const watchLists = await createTaskWatchLists(auctions, users);
    const auctionNotifications = await createAuctionNotifications(auctions, users);
    const auctionReviews = await createAuctionReviews(auctions);

    // 8. グループポイントデータの作成
    const groupPoints = await createGroupPoints(users, auctions);

    // 9. 統計情報の表示
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
    console.log(`通知: ${notifications.length}件`);
    console.log(`通知既読状態: ${notificationReadStatuses.length}件`);
    console.log(`オークション: ${auctions.length}件`);
    console.log(`入札履歴: ${bidHistories.length}件`);
    console.log(`自動入札設定: ${autoBids.length}件`);
    console.log(`ウォッチリスト: ${watchLists.length}件`);
    console.log(`オークション通知: ${auctionNotifications.length}件`);
    console.log(`オークションレビュー: ${auctionReviews.length}件`);
    console.log(`グループポイント: ${groupPoints.length}件`);
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
