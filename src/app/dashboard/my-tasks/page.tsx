import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { MainTemplate } from "@/components/layout/maintemplate";
import { MyTasksTable } from "@/components/task/my-tasks-table";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
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
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  // ユーザーのタスクを取得
  const tasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      user: {
        select: {
          name: true,
        },
      },
      group: {
        select: {
          name: true,
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
        <div>タスクがありません</div>
      </MainTemplate>
    );
  }

  return (
    <MainTemplate
      title="My Task一覧"
      description="自分のタスク一覧を表示します"
      component={
        <Button asChild className="button-default-custom w-auto self-start text-white sm:self-center">
          <Link href="/dashboard/my-tasks/new" className="flex items-center">
            <PlusCircle className="h-4 w-4" />
            新規Task作成
          </Link>
        </Button>
      }
    >
      <MyTasksTable tasks={tasks} />
    </MainTemplate>
  );
}
