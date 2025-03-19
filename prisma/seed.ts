import { faker } from "@faker-js/faker/locale/ja";
import { contributionType, NotificationTargetType, NotificationType, PrismaClient, TaskStatus } from "@prisma/client";

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
const PRESERVED_USER_IDS = ["cm8ftmmtg0000mccb2pwdzd6n"];

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

/**
 * ユーザーに関連するアカウントデータを生成する関数
 * @param users ユーザーの配列
 * @returns 生成されたアカウントの配列
 */
async function createAccounts(users: any[]) {
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
async function createSessions(users: any[]) {
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
async function createUserSettings(users: any[]) {
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
async function createGroups(users: any[]) {
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
async function createGroupMemberships(groups: any[], users: any[], minMembersPerGroup: number, maxMembersPerGroup: number) {
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

/**
 * タスクを生成する関数
 * @param count 生成するタスク数
 * @param groupMemberships グループメンバーシップの配列
 * @param users ユーザーの配列（評価者として使用）
 * @returns 生成されたタスクの配列
 */
async function createTasks(count: number, groupMemberships: any[], users: any[]) {
  const tasks = [];
  const taskStatuses = Object.values(TaskStatus);
  const contributionTypes = Object.values(contributionType);

  for (let i = 0; i < count; i++) {
    // ランダムにメンバーシップを選択
    const membership = faker.helpers.arrayElement(groupMemberships);
    const creator = users.find((u) => u.id === membership.userId) || faker.helpers.arrayElement(users);
    const groupId = membership.groupId;

    // タスクの詳細を生成
    const taskTitle = faker.company.catchPhrase();
    const taskStatus = faker.helpers.arrayElement(taskStatuses);

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

    // タスク作成
    const task = await prisma.task.create({
      data: {
        task: taskTitle,
        detail: faker.lorem.paragraph(),
        reference: faker.datatype.boolean(0.3) ? faker.internet.url() : null,
        status: taskStatus,
        fixedContributionPoint: fixedPoints,
        fixedEvaluator,
        fixedEvaluationLogic,
        info,
        contributionType: faker.helpers.arrayElement(contributionTypes),
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
async function createAnalytics(tasks: any[], users: any[]) {
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
      const basePoint = task.fixedContributionPoint || faker.number.int({ min: 10, max: 50 });
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
async function createNotifications(users: any[], groups: any[], tasks: any[]) {
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
        // @ts-ignore - isReadプロパティはスキーマには存在するがTyped Prisma Clientが認識していない場合
        const notification = await prisma.notification.create({
          data: {
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

    // 7. 統計情報の表示
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
    console.log("-------------------------------------");
  } catch (error) {
    console.error("シード作成エラー:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// プログラム実行
main();
