import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { MainTemplate } from "@/components/layout/maintemplate";
import { CreateNotificationForm } from "@/components/notification/create-notification-form";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "通知作成 - Freeism App",
  description: "アプリ内通知を作成します",
};

export default async function CreateNotificationPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <MainTemplate title="ログインが必要です" description="このページを利用するにはログインが必要です。">
        <div className="flex min-h-[70vh] flex-col items-center justify-center">
          <h1 className="mb-4 text-2xl font-bold">ログインが必要です</h1>
          <p>このページを利用するにはログインが必要です。</p>
          <Link href="/auth/signin">
            <Button className="mt-4">ログイン画面へ</Button>
          </Link>
        </div>
      </MainTemplate>
    );
  }

  // ユーザー情報とグループオーナー情報を取得
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      isAppOwner: true,
    },
  });

  const userGroupMemberships = await prisma.groupMembership.findMany({
    where: {
      userId: session.user.id,
      isGroupOwner: true,
    },
  });

  const isAppOwner = user?.isAppOwner || false;
  const isGroupOwner = userGroupMemberships.length > 0;

  // 権限チェック
  const hasPermission = isAppOwner || isGroupOwner;

  if (!hasPermission) {
    return (
      <MainTemplate title="オーナー権限がありません" description="通知作成には権限が必要です">
        <div className="container max-w-4xl py-10">
          <Link href="/dashboard" className="mb-6 flex items-center text-blue-600 hover:underline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            ダッシュボードに戻る
          </Link>
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <h1 className="mb-4 text-2xl font-bold text-red-700">オーナー権限がありません</h1>
            <p className="text-red-600">通知作成には、アプリオーナー権限またはいずれかのグループでグループオーナー権限が必要です。</p>
          </div>
        </div>
      </MainTemplate>
    );
  }

  // データの取得
  // ユーザー一覧を取得（アプリオーナーの場合のみ）
  const users = isAppOwner
    ? await prisma.user.findMany({
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: "asc",
        },
      })
    : [];

  // ユーザーデータを整形（null nameを処理）
  const formattedUsers = users.map((user) => ({
    id: user.id,
    name: user.name || "名前なし",
  }));

  // グループ一覧を取得
  const groups = isAppOwner
    ? await prisma.group.findMany({
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: "asc",
        },
      })
    : await prisma.group.findMany({
        where: {
          members: {
            some: {
              userId: session.user.id,
              isGroupOwner: true,
            },
          },
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: "asc",
        },
      });

  // タスク一覧を取得
  const tasks = isAppOwner
    ? await prisma.task.findMany({
        select: {
          id: true,
          task: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    : await prisma.task.findMany({
        where: {
          group: {
            members: {
              some: {
                userId: session.user.id,
                isGroupOwner: true,
              },
            },
          },
        },
        select: {
          id: true,
          task: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

  return (
    <MainTemplate title="通知作成" description="アプリ内通知を作成します">
      <div className="container max-w-4xl py-10">
        <Link href="/dashboard" className="mb-6 flex items-center text-blue-600 hover:underline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          ダッシュボードに戻る
        </Link>

        <div className="space-y-6">
          <div>
            <h1 className="mb-2 text-3xl font-bold">通知作成</h1>
            <p className="text-gray-600">
              アプリ内の通知を作成します。
              {isAppOwner ? "アプリオーナー権限" : "グループオーナー権限"}で操作しています。
            </p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <CreateNotificationForm isAppOwner={isAppOwner} isGroupOwner={isGroupOwner} users={formattedUsers} groups={groups} tasks={tasks} />
          </div>
        </div>
      </div>
    </MainTemplate>
  );
}
