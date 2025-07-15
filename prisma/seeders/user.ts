import { faker } from "@faker-js/faker/locale/ja";
import { PrismaClient } from "@prisma/client";

import type { OAuthProvider, SeedUser } from "./types";
import { PRESERVED_USER_IDS } from "./config";

const prisma = new PrismaClient();

export async function createUsers(count: number): Promise<SeedUser[]> {
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

export async function createAccounts(users: SeedUser[]) {
  const accounts = [];
  const providers: OAuthProvider[] = ["google", "github", "facebook"];

  for (const user of users) {
    // 既存のアカウントがあるかチェック
    const existingAccount = await prisma.account.findFirst({
      where: { userId: user.id },
    });

    // 存在しない場合のみ作成
    if (!existingAccount) {
      const provider = faker.helpers.arrayElement(providers);
      const providerAccountId = `${provider}_${Date.now()}_${faker.string.uuid()}`;

      // 既存のproviderAccountIdがないかチェック
      const existingProviderAccount = await prisma.account.findFirst({
        where: {
          provider,
          providerAccountId,
        },
      });

      if (!existingProviderAccount) {
        const account = await prisma.account.create({
          data: {
            userId: user.id,
            type: "oauth",
            provider,
            providerAccountId,
            refresh_token: faker.string.alphanumeric(40),
            access_token: faker.string.alphanumeric(40),
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "Bearer",
            scope: "openid profile email",
            id_token: faker.string.alphanumeric(50),
          },
        });
        accounts.push(account);
      } else {
        console.log(`プロバイダー ${provider} のアカウントID ${providerAccountId} は既に存在するためスキップします`);
      }
    } else {
      console.log(`ユーザーID ${user.id} のアカウントは既に存在するためスキップします`);
    }
  }

  console.log(`${accounts.length}件のアカウントを作成しました`);
  return accounts;
}

export async function createSessions(users: SeedUser[]) {
  const sessions = [];

  for (const user of users) {
    // 既存のセッションがあるかチェック
    const existingSession = await prisma.session.findFirst({
      where: { userId: user.id },
    });

    // 存在しない場合のみ作成
    if (!existingSession) {
      const session = await prisma.session.create({
        data: {
          userId: user.id,
          sessionToken: faker.string.uuid(),
          expires: faker.date.future(),
        },
      });
      sessions.push(session);
    } else {
      console.log(`ユーザーID ${user.id} のセッションは既に存在するためスキップします`);
    }
  }

  console.log(`${sessions.length}件のセッションを作成しました`);
  return sessions;
}

export async function createUserSettings(users: SeedUser[]) {
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

export async function createVerificationTokens(count: number) {
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
