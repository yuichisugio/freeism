import type { Metadata } from "next";
import { cache } from "react";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { SetupForm } from "@/components/auth/setup-form";
import { MainTemplate } from "@/components/layout/maintemplate";
import { EmailNotificationToggle } from "@/components/notification/email-notification-toggle";
import { WebPushNotificationToggle } from "@/components/notification/push-notification-toggle";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メタデータ
 */
export const metadata: Metadata = {
  title: "Settings - Freeism App",
  description: "User settings and preferences",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー設定を取得
 */
const getUserSettings = cache(async (userId: string) => {
  "use cache";
  cacheLife("hours");
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId: userId },
  });
  return userSettings;
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 設定ページ
 */
export default async function SettingsPage() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーIDを取得
   */
  const userId = await getAuthenticatedSessionUserId();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザー設定を取得
   */
  const userSettings = await getUserSettings(userId);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザー設定が見つからない場合は早期リターン
   */
  if (!userSettings) {
    return (
      <MainTemplate title="Settings" description="アカウント設定とプロフィールを管理します">
        <div>ユーザー設定が見つかりません</div>
        <p>push通知とemail通知の設定をしたい場合は、こちらのフォームを設定してください。</p>
        <SetupForm initialData={userSettings} />
      </MainTemplate>
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザー設定が見つかった場合は設定ページを表示
   */
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

      {/* プッシュ通知設定 */}
      <div className="mb-8">
        <WebPushNotificationToggle userSettings={userSettings} />
      </div>

      <div className="mb-8">
        <EmailNotificationToggle userSettings={userSettings} />
      </div>

      {/* フォームコンテナ */}
      <div className="rounded-xl border border-blue-100 bg-white/80 p-6 shadow-lg shadow-blue-100/20 backdrop-blur-sm sm:p-8 dark:border-blue-800 dark:bg-blue-950 dark:shadow-blue-800/20">
        <SetupForm initialData={userSettings} />
      </div>
    </MainTemplate>
  );
}
