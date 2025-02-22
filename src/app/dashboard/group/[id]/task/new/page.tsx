import type { Metadata } from "next";
import { Suspense } from "react";
import { TaskInputForm } from "@/components/group/task-input-form";
import { MainTemplate } from "@/components/layout/maintemplate";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "タスクを作成 - Freeism App",
  description: "タスクを作成します",
};

type TaskInputPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TaskInputPage({ params }: TaskInputPageProps) {
  const { id } = await params;

  // グループ情報を取得
  const group = await prisma.group.findUnique({
    where: { id: id },
    select: { name: true },
  });

  if (!group) {
    throw new Error("グループが見つかりません");
  }

  return (
    <MainTemplate title={`「${group.name}」の貢献タスクの入力`} description={`貢献タスクを入力します`}>
      <Suspense fallback={<div>Loading...</div>}>
        <TaskInputForm groupId={id} />
      </Suspense>
    </MainTemplate>
  );
}
