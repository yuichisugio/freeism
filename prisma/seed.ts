import { faker } from "@faker-js/faker/locale/ja";
import { PrismaClient, TaskStatus } from "@prisma/client";

// データ作成数の設定（ここを変更するだけで全体のデータ量を調整できます）
/*
設定を変更する際に注意すべき点として、データ間の依存関係があります：
アカウント、セッション、ユーザー設定: これらは各ユーザーに1つずつ作成されるため、USERS_COUNTに依存します
グループメンバーシップ: グループ数と各グループのメンバー数（最小・最大）に依存します
タスク: グループメンバーシップに依存しており、少なくともメンバーシップの数以下である必要があります
そのため、例えばUSERS_COUNTを減らす場合は、グループあたりの最大メンバー数が実際のユーザー数を超えないように注意する必要があります。
*/
const SEED_CONFIG = {
  USERS_COUNT: 15, // ユーザー数
  VERIFICATION_TOKENS_COUNT: 10, // 認証トークン数
  GROUPS_COUNT: 12, // グループ数
  MIN_MEMBERS_PER_GROUP: 3, // グループごとの最小メンバー数
  MAX_MEMBERS_PER_GROUP: 7, // グループごとの最大メンバー数
  TASKS_COUNT: 30, // タスク数
};

const prisma = new PrismaClient();

async function main() {
  try {
    // データベースをクリーンアップ（依存関係の順序に注意）
    await prisma.task.deleteMany();
    await prisma.groupMembership.deleteMany();
    await prisma.group.deleteMany();
    await prisma.userSettings.deleteMany();
    await prisma.session.deleteMany();
    await prisma.verificationToken.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();

    console.log("データベースをクリーンアップしました");

    // ユーザーデータの作成
    const users = [];
    for (let i = 0; i < SEED_CONFIG.USERS_COUNT; i++) {
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

    // アカウントデータの作成（各ユーザーに1つずつ）
    const accounts = [];
    for (const user of users) {
      const provider = faker.helpers.arrayElement(["google", "github", "facebook"]);
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

    // セッションデータの作成（各ユーザーに1つずつ）
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

    // 認証トークンの作成
    const verificationTokens = [];
    for (let i = 0; i < SEED_CONFIG.VERIFICATION_TOKENS_COUNT; i++) {
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

    // ユーザー設定の作成（各ユーザーに1つずつ）
    const userSettings = [];
    for (const user of users) {
      const userSetting = await prisma.userSettings.create({
        data: {
          userId: user.id,
          username: faker.internet.username(), // userName()からusername()に修正
          lifeGoal: faker.lorem.paragraph(),
        },
      });
      userSettings.push(userSetting);
    }
    console.log(`${userSettings.length}件のユーザー設定を作成しました`);

    // グループデータの作成
    const groups = [];
    for (let i = 0; i < SEED_CONFIG.GROUPS_COUNT; i++) {
      const creatorUser = users[Math.floor(Math.random() * users.length)];
      const group = await prisma.group.create({
        data: {
          name: `${faker.company.name()} グループ ${i + 1}`,
          goal: faker.company.catchPhrase(),
          evaluationMethod: faker.helpers.arrayElement(["360度評価", "相互評価", "目標達成度", "KPI評価", "コンピテンシー評価"]),
          maxParticipants: faker.number.int({ min: 5, max: 20 }),
          createdBy: creatorUser.id,
        },
      });
      groups.push(group);
    }
    console.log(`${groups.length}件のグループを作成しました`);

    // グループメンバーシップの作成
    const memberships = [];
    const membershipSet = new Set(); // 重複チェック用

    // 各グループにランダムな数のメンバーを追加
    for (const group of groups) {
      const numMembers = faker.number.int({
        min: SEED_CONFIG.MIN_MEMBERS_PER_GROUP,
        max: SEED_CONFIG.MAX_MEMBERS_PER_GROUP,
      });
      const shuffledUsers = [...users].sort(() => 0.5 - Math.random());

      for (let i = 0; i < numMembers && i < shuffledUsers.length; i++) {
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

    // タスクデータの作成
    const tasks = [];
    const taskStatuses = Object.values(TaskStatus);
    const contributionTypes = ["REWARD", "NON_REWARD"];

    for (let i = 0; i < SEED_CONFIG.TASKS_COUNT; i++) {
      // ランダムにメンバーシップを選択
      const randomMembership = memberships[Math.floor(Math.random() * memberships.length)];

      const task = await prisma.task.create({
        data: {
          task: faker.lorem.sentence(),
          reference: faker.datatype.boolean() ? faker.internet.url() : null,
          status: faker.helpers.arrayElement(taskStatuses),
          contributionPoint: faker.number.int({ min: 1, max: 100 }),
          evaluator: faker.datatype.boolean() ? users[Math.floor(Math.random() * users.length)].id : null,
          evaluationLogic: faker.datatype.boolean() ? faker.lorem.paragraph(1) : null,
          contributionType: faker.helpers.arrayElement(contributionTypes),
          userId: randomMembership.userId,
          groupId: randomMembership.groupId,
        },
      });
      tasks.push(task);
    }
    console.log(`${tasks.length}件のタスクを作成しました`);

    // 統計情報
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

main();
