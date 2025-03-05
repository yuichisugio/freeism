import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { MainTemplate } from "@/components/layout/maintemplate";
import { CreateNotificationForm } from "@/components/notification/create-notification-form";
import { prisma } from "@/lib/prisma";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "通知作成 - Freeism App",
  description: "アプリ内通知を作成します",
};

export default async function CreateNotificationPage() {
  const session = await auth();
  const sessionUserId = session?.user?.id;

  if (!sessionUserId) {
    return null;
  }
  // ユーザー情報とAppオーナー情報を取得
  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: {
      id: true,
      isAppOwner: true,
    },
  });

  // グループオーナー情報を取得
  const userGroupMemberships = await prisma.groupMembership.findMany({
    where: {
      userId: sessionUserId,
    },
    select: {
      groupId: true,
      isGroupOwner: true,
    },
  });

  // オーナー権限チェック。someは配列が条件を一つでも満たしていればtrueを返す
  const isAppOwner = user?.isAppOwner ?? false;
  const isGroupOwner = userGroupMemberships.some((membership) => membership.isGroupOwner);

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

  // データの取得。ユーザー一覧を取得（アプリオーナーの場合のみ）
  let users: { id: string; name: string | null }[] = [];
  if (isAppOwner) {
    users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });
  } else {
    users = [];
  }

  // ユーザーデータを整形（null nameを処理）
  const formattedUsers = users.map((user) => ({
    id: user.id,
    name: user.name || "名前なし",
  }));

  // グループ一覧を取得
  let groups: { id: string; name: string }[] = [];
  // アプリオーナーの場合は全てのグループを取得
  if (isAppOwner) {
    groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });
    // グループオーナーの場合は自分がオーナーのグループを取得
  } else if (isGroupOwner) {
    groups = await prisma.group.findMany({
      where: {
        members: {
          some: {
            userId: sessionUserId,
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
  }

  // タスク一覧を取得
  let tasks: { id: string; task: string }[] = [];
  // アプリオーナーの場合は全てのタスクを取得
  if (isAppOwner) {
    tasks = await prisma.task.findMany({
      select: {
        id: true,
        task: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    // グループオーナーの場合は自分がオーナーのグループのタスクを取得
  } else if (isGroupOwner) {
    tasks = await prisma.task.findMany({
      where: {
        group: {
          members: {
            some: {
              userId: sessionUserId,
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
  }

  return (
    <MainTemplate title="通知作成" description="アプリ内通知を作成します">
      <CreateNotificationForm isAppOwner={isAppOwner} isGroupOwner={isGroupOwner} users={formattedUsers} groups={groups} tasks={tasks} />
    </MainTemplate>
  );
}
