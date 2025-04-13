import type { Metadata } from "next";
import Link from "next/link";
import { MainTemplate } from "@/components/layout/maintemplate";
import { MyTasksTable } from "@/components/task/my-tasks-table";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { PlusCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "My Task一覧 - Freeism App",
  description: "自分のタスク一覧を表示します",
};

/**
 * ログインしているユーザーのタスク一覧を表示するページ
 */
export default async function MyTasksPage() {
  // ログインしているユーザーの情報を取得
  const userId = await getAuthenticatedSessionUserId();

  // ユーザーのタスクを取得（作成者、報告者、実行者のいずれかが自分のタスク）
  const tasks = await prisma.task.findMany({
    where: {
      OR: [
        // 自分が作成者のタスク
        { creatorId: userId },
        // 自分が報告者として含まれるタスク
        {
          reporters: {
            some: {
              userId: userId,
            },
          },
        },
        // 自分が実行者として含まれるタスク
        {
          executors: {
            some: {
              userId: userId,
            },
          },
        },
      ],
    },
    include: {
      creator: {
        select: {
          name: true,
          id: true,
        },
      },
      reporters: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      executors: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      group: {
        select: {
          name: true,
          id: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // タスクがない場合は、タスクがない旨を表示
  if (tasks.length === 0) {
    return (
      <MainTemplate title="My Task一覧" description="自分のタスク一覧を表示します">
        <div className="p-8 text-center">
          <p className="mb-4">タスクがありません</p>
          <Button asChild className="button-default-custom text-white">
            <Link href="/dashboard/new-task" className="flex items-center">
              <PlusCircle className="mr-2 h-4 w-4" />
              新規Task作成
            </Link>
          </Button>
        </div>
      </MainTemplate>
    );
  }

  return (
    <MainTemplate
      title="My Task一覧"
      description="自分のタスク一覧を表示します"
      component={
        <Button asChild className="button-default-custom w-auto self-start text-white sm:self-center">
          <Link href="/dashboard/new-task" className="flex items-center">
            <PlusCircle className="mr-2 h-4 w-4" />
            新規Task作成
          </Link>
        </Button>
      }
    >
      <MyTasksTable tasks={tasks} />
    </MainTemplate>
  );
}
