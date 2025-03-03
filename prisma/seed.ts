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
  USERS_COUNT: 15, // ユーザー数
  VERIFICATION_TOKENS_COUNT: 10, // 認証トークン数
  GROUPS_COUNT: 12, // グループ数
  MIN_MEMBERS_PER_GROUP: 3, // グループごとの最小メンバー数
  MAX_MEMBERS_PER_GROUP: 7, // グループごとの最大メンバー数
  TASKS_COUNT: 30, // タスク数
  NOTIFICATIONS_PER_USER: 10, // ユーザーごとの通知数
};

// プロバイダータイプの定義
type OAuthProvider = "google" | "github" | "facebook";
type ContributionType = "REWARD" | "NON_REWARD";
type EvaluationMethod = "360度評価" | "相互評価" | "目標達成度" | "KPI評価" | "コンピテンシー評価";

// Prismaクライアントのインスタンス化
const prisma = new PrismaClient();

/**
 * データベースをクリーンアップする関数
 * 依存関係を考慮した順序でテーブルを空にします
 */
async function cleanupDatabase() {
  // 依存関係の順序に注意してクリーンアップ
  await prisma.notification.deleteMany(); // 通知を先に削除
  await prisma.analytics.deleteMany();
  await prisma.task.deleteMany();
  await prisma.groupMembership.deleteMany();
  await prisma.group.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.session.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  console.log("データベースをクリーンアップしました");
}

/**
 * ユーザーデータを生成する関数
 * @param count 生成するユーザー数
 * @returns 生成されたユーザーの配列
 */
async function createUsers(count: number) {
  const users = [];

  for (let i = 0; i < count; i++) {
    // 10%の確率でアプリオーナー権限を付与
    const isAppOwner = faker.datatype.boolean(0.1);

    const user = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        image: faker.image.avatar(),
        emailVerified: faker.date.past(),
        isAppOwner, // アプリオーナー権限を設定
      },
    });
    users.push(user);
  }

  console.log(`${users.length}件のユーザーを作成しました`);
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
 * 認証トークンを生成する関数
 * @param count 生成するトークン数
 * @returns 生成された認証トークンの配列
 */
async function createVerificationTokens(count: number) {
  const verificationTokens = [];

  for (let i = 0; i < count; i++) {
    const verificationToken = await prisma.verificationToken.create({
      data: {
        identifier: faker.internet.email(),
        token: faker.string.uuid(),
        expires: faker.date.future(),
      },
    });
    verificationTokens.push(verificationToken);
  }

  console.log(`${verificationTokens.length}件の認証トークンを作成しました`);
  return verificationTokens;
}

/**
 * ユーザー設定を生成する関数
 * @param users ユーザーの配列
 * @returns 生成されたユーザー設定の配列
 */
async function createUserSettings(users: any[]) {
  const userSettings = [];

  for (const user of users) {
    const userSetting = await prisma.userSettings.create({
      data: {
        userId: user.id,
        username: faker.internet.username(),
        lifeGoal: faker.lorem.paragraph(),
      },
    });
    userSettings.push(userSetting);
  }

  console.log(`${userSettings.length}件のユーザー設定を作成しました`);
  return userSettings;
}

/**
 * グループを生成する関数
 * @param count 生成するグループ数
 * @param users ユーザーの配列（作成者として使用）
 * @returns 生成されたグループの配列
 */
async function createGroups(count: number, users: any[]) {
  const groups = [];
  const evaluationMethods: EvaluationMethod[] = ["360度評価", "相互評価", "目標達成度", "KPI評価", "コンピテンシー評価"];

  for (let i = 0; i < count; i++) {
    const creatorUser = faker.helpers.arrayElement(users);
    const group = await prisma.group.create({
      data: {
        name: `${faker.company.name()} グループ ${i + 1}`,
        goal: faker.company.catchPhrase(),
        evaluationMethod: faker.helpers.arrayElement(evaluationMethods),
        maxParticipants: faker.number.int({ min: 5, max: 20 }),
        createdBy: creatorUser.id,
      },
    });
    groups.push(group);
  }

  console.log(`${groups.length}件のグループを作成しました`);
  return groups;
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

  // 各グループにランダムな数のメンバーを追加
  for (const group of groups) {
    const numMembers = faker.number.int({
      min: minMembersPerGroup,
      max: Math.min(maxMembersPerGroup, users.length),
    });

    // ランダムな順序でユーザーをシャッフル
    const shuffledUsers = [...users].sort(() => 0.5 - Math.random());

    for (let i = 0; i < numMembers; i++) {
      const user = shuffledUsers[i];
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
 * @param memberships グループメンバーシップの配列
 * @param users ユーザーの配列（評価者として使用）
 * @returns 生成されたタスクの配列
 */
async function createTasks(count: number, memberships: any[], users: any[]) {
  const tasks = [];
  const taskStatuses = Object.values(TaskStatus);
  const contributionTypes: ContributionType[] = ["REWARD", "NON_REWARD"];

  for (let i = 0; i < count; i++) {
    // ランダムにメンバーシップを選択
    const randomMembership = faker.helpers.arrayElement(memberships);

    const task = await prisma.task.create({
      data: {
        task: faker.lorem.sentence(),
        reference: faker.datatype.boolean() ? faker.internet.url() : null,
        status: faker.helpers.arrayElement(taskStatuses),
        fixedContributionPoint: faker.number.int({ min: 1, max: 100 }),
        evaluator: faker.datatype.boolean() ? faker.helpers.arrayElement(users).id : null,
        evaluationLogic: faker.datatype.boolean() ? faker.lorem.paragraph(1) : null,
        contributionType: faker.helpers.arrayElement(contributionTypes),
        userId: randomMembership.userId,
        groupId: randomMembership.groupId,
      },
    });
    tasks.push(task);
  }

  console.log(`${tasks.length}件のタスクを作成しました`);
  return tasks;
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

  // 各ユーザーに対して通知を生成
  for (const user of users) {
    // ユーザーごとの通知数を決定
    const notificationCount = faker.number.int({
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

      // 一部の通知を既読にする
      const isRead = faker.datatype.boolean(0.6); // 60%の確率で既読
      let readAt = null;

      if (isRead) {
        // 送信時間から現在までの間のランダムな時間を既読時間とする
        const readDate = new Date(sentAt);
        const minutesAfterSent = faker.number.int({ min: 1, max: 60 * 24 * 3 }); // 最大3日後
        readDate.setMinutes(readDate.getMinutes() + minutesAfterSent);
        readAt = readDate;
      }

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
          // ランダムにグループを選択
          const randomGroup = faker.helpers.arrayElement(groups);
          groupId = randomGroup.id;
          title = faker.helpers.arrayElement([
            `「${randomGroup.name}」の新着情報`,
            `「${randomGroup.name}」からのお知らせ`,
            `「${randomGroup.name}」メンバー募集`,
            `「${randomGroup.name}」活動報告`,
          ]);
          message = faker.lorem.paragraph();
          actionUrl = `/dashboard/groups/${randomGroup.id}`;
          break;

        case "TASK":
          // ランダムにタスクを選択
          const randomTask = faker.helpers.arrayElement(tasks);
          taskId = randomTask.id;
          groupId = randomTask.groupId;
          title = faker.helpers.arrayElement([
            `タスク「${randomTask.task.substring(0, 20)}...」の更新`,
            `タスク期限のお知らせ`,
            `タスク評価の完了`,
            `タスク状態の変化`,
          ]);
          message = faker.lorem.paragraph();
          actionUrl = `/dashboard/tasks/${randomTask.id}`;
          break;
      }

      // 通知をデータベースに追加
      const notification = await prisma.notification.create({
        data: {
          title,
          message,
          type: notificationType,
          targetType,
          isRead,
          sentAt,
          readAt,
          actionUrl,
          userId: user.id,
          groupId,
          taskId,
          expiresAt: faker.datatype.boolean(0.3) ? faker.date.future() : null, // 30%の確率で有効期限あり
        },
      });

      notifications.push(notification);
    }
  }

  console.log(`${notifications.length}件の通知を作成しました`);
  return notifications;
}

/**
 * メイン関数
 * シードデータを生成する全体の流れを制御します
 */
async function main() {
  try {
    // 1. データベースクリーンアップ
    await cleanupDatabase();

    // 2. ユーザー関連データの作成
    const users = await createUsers(SEED_CONFIG.USERS_COUNT);
    const accounts = await createAccounts(users);
    const sessions = await createSessions(users);
    const verificationTokens = await createVerificationTokens(SEED_CONFIG.VERIFICATION_TOKENS_COUNT);
    const userSettings = await createUserSettings(users);

    // 3. グループ関連データの作成
    const groups = await createGroups(SEED_CONFIG.GROUPS_COUNT, users);
    const memberships = await createGroupMemberships(groups, users, SEED_CONFIG.MIN_MEMBERS_PER_GROUP, SEED_CONFIG.MAX_MEMBERS_PER_GROUP);

    // 4. タスクデータの作成
    const tasks = await createTasks(SEED_CONFIG.TASKS_COUNT, memberships, users);

    // 5. 通知データの作成
    const notifications = await createNotifications(users, groups, tasks);

    // 6. 統計情報の表示
    console.log("\n--- データベースシード完了 ---");
    console.log(`ユーザー: ${users.length}件`);
    console.log(`アカウント: ${accounts.length}件`);
    console.log(`セッション: ${sessions.length}件`);
    console.log(`認証トークン: ${verificationTokens.length}件`);
    console.log(`ユーザー設定: ${userSettings.length}件`);
    console.log(`グループ: ${groups.length}件`);
    console.log(`グループメンバーシップ: ${memberships.length}件`);
    console.log(`タスク: ${tasks.length}件`);
    console.log(`通知: ${notifications.length}件`);
  } catch (e) {
    console.error("シード処理中にエラーが発生しました:", e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// プログラム実行
main();
