import type { Account as PrismaAccount } from "@prisma/client";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// セッションオブジェクトの型を拡張
type ExtendedSession = Session & {
  access_token?: string;
  refresh_token?: string;
};

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
        const accountData = {
          id: account.providerAccountId,
          userId: user.id,
          type: account.type ?? "oauth",
          provider: account.provider ?? "",
          providerAccountId: account.providerAccountId ?? "",
          access_token: account.access_token?.toString() ?? null,
          refresh_token: account.refresh_token?.toString() ?? null,
          expires_at: account.expires_at ?? null,
          token_type: account.token_type?.toString() ?? null,
          scope: account.scope?.toString() ?? null,
          id_token: account.id_token?.toString() ?? null,
          session_state: account.session_state?.toString() ?? null,
          //accountData型は、AccountテーブルのカラムからcreatedAtとupdatedAtを除いた型
        } satisfies Omit<PrismaAccount, "createdAt" | "updatedAt">;

        await prisma.account.create({
          data: accountData,
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
