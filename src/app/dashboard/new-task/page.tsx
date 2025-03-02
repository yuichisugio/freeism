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

export default async function NewTaskPage({ searchParams }: { searchParams: { groupId?: string } }) {
  // グループ選択のComboBoxが必要かのフラグ
  let groupComboBoxFlag = false;

  // searchParamsはPromiseを返すためawaitする
  const params = await Promise.resolve(searchParams);
  const groupId = params.groupId;
  console.log("page.tsxのgroupId: ", groupId);

  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  let groups: { id: string; name: string }[] = [];

  console.log("ARG groupId: ", groupId ? "true" : "false");

  if (!groupId) {
    // グループ選択のComboBoxが必要な場合
    groupComboBoxFlag = true;
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

    groups = memberships.map((membership) => ({
      id: membership.group.id,
      name: membership.group.name,
    }));

    console.log("page.tsxのmemberships: ", memberships);
  } else {
    groupComboBoxFlag = false;
    groups = [
      {
        id: groupId,
        name: "",
      },
    ];
  }

  console.log("page.tsxのgroups: ", groups);

  return (
    <MainTemplate title="新規Task作成" description="新規タスクを作成します">
      <Suspense fallback={<div>Loading...</div>}>
        <TaskInputForm groups={groups} groupComboBoxFlag={groupComboBoxFlag} />
      </Suspense>
    </MainTemplate>
  );
}
