import type { Metadata } from "next";
import { auth } from "@/auth";
import { SetupForm } from "@/components/auth/setup-form";
import { MainTemplate } from "@/components/layout/maintemplate";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Settings - Freeism App",
  description: "User settings and preferences",
};

export default async function SettingsPage() {
  // セッションを取得
  const session = await auth();

  // ユーザーが認証されていない場合は早期リターン
  if (!session?.user?.id) {
    return null;
  }

  // 現在のユーザー設定を取得
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
  });

  return (
    <MainTemplate title="Settings" description="アカウント設定とプロフィールを管理します">
      {/* 現在の設定情報 */}
      {userSettings && (
        <div className="mb-8 rounded-xl border border-blue-100 bg-white/80 p-6 shadow-lg shadow-blue-100/20 backdrop-blur-sm sm:p-8 dark:border-blue-800 dark:bg-blue-950 dark:shadow-blue-800/20">
          <h2 className="text-app dark:text-app-dark mb-4 text-xl font-bold">現在の設定</h2>
          <dl className="space-y-4">
            <div>
              <dt className="form-label-custom">ユーザー名</dt>
              <dd className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">{userSettings.username}</dd>
            </div>
            <div>
              <dt className="form-label-custom">人生の目標</dt>
              <dd className="mt-1 text-sm whitespace-pre-wrap text-neutral-900 dark:text-neutral-100">{userSettings.lifeGoal}</dd>
            </div>
            <div>
              <dt className="form-label-custom">最終更新日</dt>
              <dd className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">{new Date(userSettings.updatedAt).toLocaleDateString("ja-JP")}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* フォームコンテナ */}
      <div className="rounded-xl border border-blue-100 bg-white/80 p-6 shadow-lg shadow-blue-100/20 backdrop-blur-sm sm:p-8 dark:border-blue-800 dark:bg-blue-950 dark:shadow-blue-800/20">
        <SetupForm initialData={userSettings} />
      </div>
    </MainTemplate>
  );
}
