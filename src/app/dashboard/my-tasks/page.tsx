import type { Metadata } from "next";
import { Suspense } from "react";
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

export default async function MyTasksPage() {
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

  return (
    <MainTemplate title={false} description={false}>
      <Suspense fallback={<div>Loading...</div>}>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="page-title-custom">My Task一覧</h1>
          <Link href="/dashboard/my-tasks/new">
            <Button className="button-default-custom">
              <PlusCircle className="mr-2 h-4 w-4" />
              新規Task作成
            </Button>
          </Link>
        </div>
        <MyTasksTable tasks={tasks} />
      </Suspense>
    </MainTemplate>
  );
}
