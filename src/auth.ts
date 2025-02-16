import type { NextAuthConfig } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * NextAuth設定のエクスポート
 * - handlers: API routeハンドラー
 * - auth: セッション取得用関数
 * - signIn: サインイン関数
 * - signOut: サインアウト関数
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  // Prismaアダプターの設定（データベースとの連携）
  adapter: PrismaAdapter(prisma),
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
  //
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
        return false;
      }
      try {
        const userData = await prisma.user.upsert({
          where: { email: user.email },
          update: {
            name: user.name ?? null,
            image: user.image ?? null,
          },
          create: {
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
          },
        });

        if (!userData) {
          return false;
        }

        const accountData = await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          update: {
            access_token: account.access_token,
          },
          create: {
            userId: userData.id,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            access_token: account.access_token,
          },
        });

        if (!accountData) {
          return false;
        }

        return true;
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
  // events: {
  //   async signIn(message) {
  //     console.log("Event: Sign in:", message);
  //   },
  //   async signOut(message) {
  //     console.log("Event: Sign out:", message);
  //   },
  //   async session(message) {
  //     console.log("Event: Session update:", message);
  //   },
  // },
} satisfies NextAuthConfig);
