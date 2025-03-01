import type { NextAuthConfig } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// ログ用ユーティリティ
const logError = (message: string, error: unknown, context?: Record<string, unknown>) => {
  console.error(message, error, context);
};

/**
 * NextAuth設定のエクスポート
 * - handlers: API routeハンドラー
 * - auth: セッション取得用関数
 * - signIn: サインイン関数
 * - signOut: サインアウト関数
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  // 認証プロバイダーの設定（Googleのみ）
  providers: [Google],
  // デバッグモードを有効にする（開発環境でのみ有効）
  // debug: process.env.NODE_ENV !== "production",
  // セッション管理の設定（jwtを使用）
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30日
    updateAge: 24 * 60 * 60, // 24時間
  },
  // データベース接続情報
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
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
        logError("認証に必要なデータが不足しています", null, { user, account });
        return false;
      }

      try {
        // トランザクション化して、途中までデータ保存して、エラーやアプリ削除で不整合がない状態にする
        return await prisma.$transaction(async (tx) => {
          // 1. まず、provider+providerAccountIdで既存アカウントを検索。
          // emailではなく、ProviderIDとProviderAccountIDの結合結果が合致する場合はログインできるようにしたい
          const existingAccount = await tx.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId,
              },
            },
            include: { user: true },
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
                session_state: account.session_state?.toString() ?? null,
              },
            });

            // ユーザー情報を更新
            await tx.user.update({
              where: { id: existingAccount.user.id },
              data: {
                // nullやundefinedの場合は既存のメールアドレスを使用
                email: user.email || existingAccount.user.email,
                name: user.name ?? existingAccount.user.name,
                image: user.image ?? existingAccount.user.image,
              },
            });

            return true;
          }

          // 3. メールアドレスで既存ユーザーを検索（同じメールの別アカウントの場合）
          const existingUserByEmail = await tx.user.findUnique({
            where: { email: user.email },
          });

          // 4A. メールアドレスで見つかった場合は、新しいアカウントを既存ユーザーに紐づける
          if (existingUserByEmail) {
            await tx.account.create({
              data: {
                userId: existingUserByEmail.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope?.toString() ?? null,
                id_token: account.id_token?.toString() ?? null,
                session_state: account.session_state?.toString() ?? null,
              },
            });

            return true;
          }

          // 4B. 完全に新規ユーザーの場合は、ユーザーとアカウントを両方作成
          const newUser = await tx.user.create({
            data: {
              email: user.email,
              name: user.name ?? null,
              image: user.image ?? null,
            },
          });

          await tx.account.create({
            data: {
              userId: newUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope?.toString() ?? null,
              id_token: account.id_token?.toString() ?? null,
              session_state: account.session_state?.toString() ?? null,
            },
          });

          return true;
        });
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.image = user.image;
      }
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
        session.user.email = token.email as string;
        session.user.name = token.name as string | null;
        session.user.image = token.image as string | null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig);
