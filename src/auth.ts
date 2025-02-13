import type { Account, DefaultSession, Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// セッションオブジェクトの型を拡張
type ExtendedSession = Session & {
  access_token?: string;
  refresh_token?: string;
};

// OAuthアカウントの型を拡張
type OAuthAccountType = {
  access_token: string | undefined;
  token_type: string | undefined;
  id_token: string | undefined;
  refresh_token: string | undefined;
  scope: string | undefined;
  session_state: string | undefined;
  expires_at: number | undefined;
} & Omit<Account, "expires_at">;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  session: { strategy: "database" },
  pages: { signIn: "/auth/signin" },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.id || !account) return false;

      try {
        // サインイン時にアカウント情報をDBに保存
        const oauthAccount = account as unknown as OAuthAccountType;
        await prisma.account.create({
          data: {
            id: account.providerAccountId,
            userId: user.id,
            type: account.type ?? "oauth",
            provider: account.provider ?? "",
            providerAccountId: account.providerAccountId ?? "",
            access_token: oauthAccount.access_token ?? null,
            refresh_token: oauthAccount.refresh_token ?? null,
            expires_at: oauthAccount.expires_at ?? null,
            token_type: oauthAccount.token_type ?? null,
            scope: oauthAccount.scope ?? null,
            id_token: oauthAccount.id_token ?? null,
            session_state: oauthAccount.session_state ?? null,
          },
        });
        return true;
      } catch (error) {
        console.error("Error creating account:", error);
        return false;
      }
    },
    async session({ session, user }) {
      // セッション情報をカスタマイズ（データベースから取得）
      const extendedSession = session as ExtendedSession;
      const account = await prisma.account.findFirst({
        where: { userId: user.id },
      });

      if (account) {
        extendedSession.access_token = account.access_token ?? undefined;
        extendedSession.refresh_token = account.refresh_token ?? undefined;
      }

      if (session.user) {
        session.user.id = user.id;
      }

      return extendedSession;
    },
  },
});
