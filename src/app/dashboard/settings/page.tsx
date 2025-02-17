import type { Metadata } from "next";
import { auth } from "@/auth";
import { SetupForm } from "@/components/auth/setup-form";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Settings - Freeism App",
  description: "User settings and preferences",
};

export default async function SettingsPage() {
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
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="container px-8 py-8">
            <h1 className="text-2xl font-bold text-blue-600 sm:text-3xl">
              Settings
            </h1>
            <p className="mt-2 text-neutral-600">
              アカウント設定とプロフィールを管理します
            </p>

            <div className="relative mx-auto max-w-2xl">
              {/* 装飾的な背景要素 */}
              <div className="absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-100/30 blur-3xl" />
              </div>

              {/* 現在の設定情報 */}
              {userSettings && (
                <div className="mb-8 rounded-xl border border-blue-100 bg-white/80 p-6 shadow-lg shadow-blue-100/20 backdrop-blur-sm sm:p-8">
                  <h2 className="mb-4 text-lg font-semibold text-blue-900 sm:text-xl">
                    現在の設定
                  </h2>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-sm font-medium text-neutral-900">
                        ユーザー名
                      </dt>
                      <dd className="mt-1 text-sm text-neutral-900">
                        {userSettings.username}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-neutral-900">
                        人生の目標
                      </dt>
                      <dd className="mt-1 text-sm whitespace-pre-wrap text-neutral-900">
                        {userSettings.lifeGoal}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-neutral-900">
                        最終更新日
                      </dt>
                      <dd className="mt-1 text-sm text-neutral-900">
                        {new Date(userSettings.updatedAt).toLocaleDateString(
                          "ja-JP",
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              {/* フォームコンテナ */}
              <div className="rounded-xl border border-blue-100 bg-white/80 p-6 shadow-lg shadow-blue-100/20 backdrop-blur-sm sm:p-8">
                <SetupForm initialData={userSettings} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
