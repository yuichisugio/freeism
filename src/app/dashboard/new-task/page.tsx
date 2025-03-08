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

  // グループに所属するユーザー一覧を取得
  let users: { id: string; name: string }[] = [];

  if (groupId) {
    // 特定のグループのメンバーを取得
    const groupMembers = await prisma.groupMembership.findMany({
      where: {
        groupId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    users = groupMembers.map((member) => ({
      id: member.user.id,
      name: member.user.name || "不明なユーザー",
    }));
  } else {
    // ユーザーが所属するすべてのグループのメンバーを取得
    const allGroupIds = groups.map((group) => group.id);

    if (allGroupIds.length > 0) {
      const groupMembers = await prisma.groupMembership.findMany({
        where: {
          groupId: {
            in: allGroupIds,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // 重複ユーザーを削除
      const uniqueUsers = new Map();
      groupMembers.forEach((member) => {
        uniqueUsers.set(member.user.id, {
          id: member.user.id,
          name: member.user.name || "不明なユーザー",
        });
      });

      users = Array.from(uniqueUsers.values());
    }
  }

  console.log("page.tsxのgroups: ", groups);

  return (
    <MainTemplate title="新規Task作成" description="新規タスクを作成します">
      <Suspense fallback={<div>Loading...</div>}>
        <TaskInputForm groups={groups} groupComboBoxFlag={groupComboBoxFlag} users={users} />
      </Suspense>
    </MainTemplate>
  );
}
