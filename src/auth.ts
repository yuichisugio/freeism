import type { Account, Session } from "next-auth";
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
 * OAuthアカウント情報の型定義
 * - 標準のAccountタイプを拡張
 * - OAuth認証で取得する各種トークンと認証情報を定義
 * - expires_atの型を調整するためにOmitで一度除外して再定義
 */
type OAuthAccountType = {
  access_token: string | undefined;
  token_type: string | undefined;
  id_token: string | undefined;
  refresh_token: string | undefined;
  scope: string | undefined;
  session_state: string | undefined;
  expires_at: number | undefined;
} & Omit<Account, "expires_at">;

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
  // 認証関連のコールバック設定
  callbacks: {
    /**
     * サインインコールバック
     * - ユーザーがサインインした際に実行
     * - アカウント情報をデータベースに保存
     * - エラー発生時はサインインを中断
     */
    async signIn({ user, account }) {
      console.log(
        "----------------------1111111111111111111111111111111----------------------",
      );
      if (!user.id || !account) return false;

      try {
        // ここまでは来ている

        // // ユーザーが存在しない場合のみ作成
        // let userData = await prisma.user.upsert({
        //   where: {
        //     email: user.email,
        //   },
        //   update: {
        //     name: user.name ?? null,
        //     image: user.image ?? null,
        //   },
        //   create: {
        //     email: user.email ?? "",
        //     name: user.name ?? null,
        //     image: user.image ?? null,
        //   },
        // });

        // アカウント情報を作成または更新
        // await prisma.account.create({
        //   data: {
        //     userId: userData.id,
        //     type: account.type ?? "oauth",
        //     provider: account.provider,
        //     providerAccountId: account.providerAccountId,
        //     access_token: account.access_token ?? null,
        //     refresh_token: account.refresh_token ?? null,
        //     expires_at: account.expires_at ? parseInt(account.expires_at.toString()) : null,
        //     token_type: account.token_type ?? null,
        //     scope: account.scope ?? null,
        //     id_token: account.id_token ?? null,
        //     session_state: account.session_state ? account.session_state.toString() : null,
        //   },
        // });

        console.log(
          "----------------------22222222222222222222222222222222----------------------",
        );

        return true;
      } catch (error) {
        console.error("Error creating account:", error);
        console.log(
          "----------------------33333333333333333333333333333333----------------------",
        );
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
      // セッション情報をカスタマイズ（データベースから取得）
      const extendedSession = session as ExtendedSession;
      const account = await prisma.account.findFirst({
        where: { userId: user.id },
      });
      const userData = await prisma.user.findFirst({
        where: { id: user.id },
      });

      // アカウント情報が存在する場合、トークン情報を追加
      if (account && userData) {
        extendedSession.access_token = account.access_token ?? undefined;
        extendedSession.refresh_token = account.refresh_token ?? undefined;
        extendedSession.username = userData.name ?? undefined;
        extendedSession.image = userData.image ?? undefined;
      }

      // ユーザーIDをセッションに追加
      if (session.user) {
        session.user.id = user.id;
      }

      return extendedSession;
    },
  },
});
