import type { NextAuthConfig } from "next-auth";
import { prisma } from "@/library-setting/prisma";
import { Prisma } from "@prisma/client";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// 設定値の集約
const AUTH_CONFIG = {
  SESSION: {
    MAX_AGE: 30 * 24 * 60 * 60, // 30日
    UPDATE_AGE: 24 * 60 * 60, // 24時間
  },
  TRANSACTION_TIMEOUT: 10000, // 10秒
};

// ログ用ユーティリティ
const logError = (message: string, error: unknown, context?: Record<string, unknown>) => {
  console.error(message, error, context);
};

// アカウント情報のインターフェース定義
type AuthAccount = {
  type: string;
  provider: string;
  providerAccountId: string;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: number | null;
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
  session_state?: string | null;
};

// アカウントデータ準備関数
function prepareAccountData(userId: string, account: AuthAccount): Prisma.AccountCreateInput {
  return {
    user: {
      connect: {
        id: userId,
      },
    },
    type: account.type,
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    access_token: account.access_token ?? null,
    refresh_token: account.refresh_token ?? null,
    expires_at: account.expires_at ?? null,
    token_type: account.token_type ?? null,
    scope: account.scope?.toString() ?? null,
    id_token: account.id_token?.toString() ?? null,
    session_state: account.session_state
      ? typeof account.session_state === "string"
        ? account.session_state
        : JSON.stringify(account.session_state)
      : null,
  };
}

/**
 * NextAuth設定のエクスポート
 * - handlers: API routeハンドラー
 * - auth: セッション取得用関数
 * - signIn: サインイン関数
 * - signOut: サインアウト関数
 */
export const { handlers, auth } = NextAuth({
  // 認証プロバイダーの設定（Googleのみ）
  providers: [Google],
  // デバッグモードを有効にする（開発環境でのみ有効）
  // debug: process.env.NODE_ENV !== "production",
  // セッション管理の設定（jwtを使用）
  session: {
    strategy: "jwt",
    maxAge: AUTH_CONFIG.SESSION.MAX_AGE,
    updateAge: AUTH_CONFIG.SESSION.UPDATE_AGE,
  },
  // データベース接続情報
  pages: {
    signIn: "/auth/signin",
  },
  // 認証関連のコールバック設定
  callbacks: {
    /**
     * サインインコールバック
     * - ユーザーがサインインした際に実行
     * - アカウント情報をデータベースに保存
     * - エラー発生時はサインインを中断
     */
    async signIn({ user, account }) {
      if (!user?.email || !account) {
        logError("認証に必要なデータが不足しています", null, {
          hasUser: !!user,
          hasEmail: !!user?.email,
          hasAccount: !!account,
        });
        return false;
      }

      try {
        // トランザクション化して、途中までデータ保存して、エラーやアプリ削除で不整合がない状態にする
        return await prisma.$transaction(
          async (tx) => {
            // 1. まず、provider+providerAccountIdで既存アカウントを検索。
            // emailではなく、ProviderIDとProviderAccountIDの結合結果が合致する場合はログインできるようにしたい
            const existingAccount = await tx.account.findUnique({
              where: {
                provider_providerAccountId: {
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                },
              },
              select: {
                id: true,
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    image: true,
                  },
                },
              },
            });

            // 2. 既存アカウントがある場合（既存ユーザー）
            if (existingAccount) {
              // アカウント情報を更新
              await tx.account.update({
                where: { id: existingAccount.id },
                data: {
                  access_token: account.access_token,
                  refresh_token: account.refresh_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope?.toString() ?? null,
                  id_token: account.id_token?.toString() ?? null,
                  session_state: account.session_state
                    ? typeof account.session_state === "string"
                      ? account.session_state
                      : JSON.stringify(account.session_state)
                    : null,
                },
              });

              // ユーザー情報を更新
              await tx.user.update({
                where: { id: existingAccount.user.id },
                data: {
                  // nullやundefinedの場合は既存のメールアドレスを使用
                  email: user.email ?? existingAccount.user.email,
                  name: user.name ?? existingAccount.user.name,
                  image: user.image ?? existingAccount.user.image,
                },
              });

              return true;
            }

            // 3. メールアドレスで既存ユーザーを検索（同じメールの別アカウントの場合）
            const existingUserByEmail = user.email
              ? await tx.user.findUnique({
                  where: { email: user.email },
                  select: {
                    id: true,
                  },
                })
              : null;

            // 4A. メールアドレスで見つかった場合は、新しいアカウントを既存ユーザーに紐づける
            if (existingUserByEmail) {
              await tx.account.create({
                data: prepareAccountData(existingUserByEmail.id, account),
              });

              return true;
            }

            // 4B. 完全に新規ユーザーの場合は、ユーザーとアカウントを両方作成
            const newUser = await tx.user.create({
              data: {
                email: user.email!, // 非nullアサーション演算子を使用
                name: user.name ?? null,
                image: user.image ?? null,
              },
            });

            // 新規アカウント作成
            await tx.account.create({
              data: prepareAccountData(newUser.id, account),
            });

            return true;
          },
          {
            timeout: AUTH_CONFIG.TRANSACTION_TIMEOUT,
            isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          },
        );
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
    },
    async jwt({ token, user, account }) {
      // 初回サインイン時のみuserとaccountが存在する
      if (user && account) {
        try {
          // providerとproviderAccountIdでデータベースからアカウント情報を取得
          const dbAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId,
              },
            },
            select: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  image: true,
                },
              },
            },
          });

          if (dbAccount) {
            // データベースのユーザーIDを使用
            token.id = dbAccount.user.id;
            token.email = dbAccount.user.email;
            token.name = dbAccount.user.name;
            token.image = dbAccount.user.image;
          } else {
            // 最悪、ユーザーのメールアドレスでデータベースからユーザー情報を取得
            const dbUser = await prisma.user.findUnique({
              where: { email: user.email! },
              select: {
                id: true,
                email: true,
                name: true,
                image: true,
              },
            });

            if (dbUser) {
              token.id = dbUser.id;
              token.email = dbUser.email;
              token.name = dbUser.name;
              token.image = dbUser.image;
            }
          }
        } catch (error) {
          console.error("Error in jwt callback:", error);
          // エラーが発生した場合でも認証プロセスを続行するために
          // ここではエラーをスローせず、デフォルトのtokenを返す
        }
      }
      // アカウント情報のアクセストークンを保存
      if (account) {
        token.accessToken = account.access_token;
      }

      return token;
    },
    /**
     * セッションコールバック
     * - セッション情報が要求されるたびに実行
     * - データベースからアカウント情報を取得
     * - アクセストークンとリフレッシュトークンをセッションに追加
     * - ユーザーIDをセッションに追加
     */
    /**
     * @param session - セッション情報
     *   - user: {
     *       name?: string | null - ユーザー名
     *       email?: string | null - メールアドレス
     *       image?: string | null - プロフィール画像URL
     *     }
     *   - expires: Date - セッションの有効期限
     * @param token - JWT token
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email!;
        session.user.name = token.name;
        session.user.image = token.image as string | null;
        session.expires = token.expires as Date & string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig);
