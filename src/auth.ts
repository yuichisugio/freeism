import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * セッション情報の型定義
 * - 標準のSessionに加えて、アクセストークンとリフレッシュトークンを追加
 * - OAuth認証後のトークン情報を保持するために使用
 */
type ExtendedSession = Session & {
  access_token?: string;
  refresh_token?: string;
  username?: string;
  image?: string;
};

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
  // セッション管理の設定（データベースを使用）
  session: { strategy: "database" },
  //
  pages: { signIn: "/auth/signin" },
  // 認証関連のコールバック設定
  callbacks: {
    /**
     * サインインコールバック
     * - ユーザーがサインインした際に実行
     * - アカウント情報をデータベースに保存
     * - エラー発生時はサインインを中断
     */
    async signIn({ user, account }) {
      try {
        if (!user?.email || !account) {
          console.error("signIn callback: user email or account is missing");
          return false;
        }

        // ユーザーが存在しない場合のみ作成
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
          console.error("Failed to create/update user");
          return false;
        }

        // アカウント情報を作成または更新
        const accountData = await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          update: {
            access_token: account.access_token ?? null,
            refresh_token: account.refresh_token ?? null,
            expires_at: account.expires_at
              ? Math.floor(account.expires_at)
              : null,
            token_type: account.token_type ?? null,
            scope: account.scope ?? null,
            id_token: account.id_token ?? null,
            session_state: account.session_state?.toString() ?? null,
          },
          create: {
            userId: userData.id,
            type: account.type ?? "oauth",
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            access_token: account.access_token ?? null,
            refresh_token: account.refresh_token ?? null,
            expires_at: account.expires_at
              ? Math.floor(account.expires_at)
              : null,
            token_type: account.token_type ?? null,
            scope: account.scope ?? null,
            id_token: account.id_token ?? null,
            session_state: account.session_state?.toString() ?? null,
          },
        });

        if (!accountData) {
          console.error("Failed to create/update account");
          return false;
        }

        // 新規ユーザー or ログインだけして初期設定の入力しなかった方は、初期設定画面へリダイレクト
        if (
          userData.lifeGoal === null &&
          userData.groupName === null &&
          userData.evaluationMethod === null
        ) {
          return "/auth/setup";
        }

        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
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
     * @param user - データベースのユーザー情報
     *   - id: string - ユーザーID
     *   - name?: string | null - ユーザー名
     *   - email: string - メールアドレス
     *   - emailVerified?: Date | null - メール確認日時
     *   - image?: string | null - プロフィール画像URL
     */
    async session({ session, user }) {
      try {
        const extendedSession = session as ExtendedSession;
        const account = await prisma.account.findFirst({
          where: { userId: user.id },
        });
        const userData = await prisma.user.findFirst({
          where: { id: user.id },
        });

        if (account && userData) {
          extendedSession.access_token = account.access_token ?? undefined;
          extendedSession.refresh_token = account.refresh_token ?? undefined;
          extendedSession.username = userData.name ?? undefined;
          extendedSession.image = userData.image ?? undefined;
        }

        if (session.user) {
          session.user.id = user.id;
        }

        return extendedSession;
      } catch (error) {
        console.error("Error in session callback:", error);
        return session;
      }
    },

    async jwt({ token, user, account }) {
      try {
        if (user) {
          token.userId = user.id;
          token.email = user.email;
        }
        if (account) {
          token.accessToken = account.access_token;
        }
        return token;
      } catch (error) {
        console.error("Error in jwt callback:", error);
        return token;
      }
    },
  },
});
