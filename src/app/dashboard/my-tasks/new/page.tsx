import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@/auth";
import { MainTemplate } from "@/components/layout/maintemplate";
import { TaskInputForm } from "@/components/task/task-input-form";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "新規Task作成 - Freeism App",
  description: "新規タスクを作成します",
};

export default async function NewTaskPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  // ユーザーが参加しているグループを取得
  const memberships = await prisma.groupMembership.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      group: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const groups = memberships.map((membership) => ({
    id: membership.group.id,
    name: membership.group.name,
  }));

  return (
    <MainTemplate title="新規Task作成" description="新規タスクを作成します">
      <Suspense fallback={<div>Loading...</div>}>
        <TaskInputForm groups={groups} />
      </Suspense>
    </MainTemplate>
  );
}
