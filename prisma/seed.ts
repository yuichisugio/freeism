import { faker } from "@faker-js/faker/locale/ja";
import { PrismaClient, TaskStatus } from "@prisma/client";

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
    const user = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        image: faker.image.avatar(),
        emailVerified: faker.date.past(),
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
        username: faker.internet.userName(),
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
        const membership = await prisma.groupMembership.create({
          data: {
            userId: user.id,
            groupId: group.id,
            joinedAt: faker.date.recent(),
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
        contributionPoint: faker.number.int({ min: 1, max: 100 }),
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

    // 5. 統計情報の表示
    console.log("\n--- データベースシード完了 ---");
    console.log(`ユーザー: ${users.length}件`);
    console.log(`アカウント: ${accounts.length}件`);
    console.log(`セッション: ${sessions.length}件`);
    console.log(`認証トークン: ${verificationTokens.length}件`);
    console.log(`ユーザー設定: ${userSettings.length}件`);
    console.log(`グループ: ${groups.length}件`);
    console.log(`グループメンバーシップ: ${memberships.length}件`);
    console.log(`タスク: ${tasks.length}件`);
  } catch (e) {
    console.error("シード処理中にエラーが発生しました:", e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// プログラム実行
main();
