import { prisma } from "../src/lib/prisma";

async function main() {
  // データベースをクリーンアップ
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.group.deleteMany(); // グループデータの削除
  await prisma.task.deleteMany(); // タスクデータの削除

  // ユーザーデータの作成
  const user1 = await prisma.user.create({
    data: {
      name: "John Doe",
      email: "john@example.com",
    },
  });

  const user2 = await prisma.user.create({
    data: {
      name: "Jane Smith",
      email: "jane@example.com",
    },
  });

  // グループデータの作成
  const group1 = await prisma.group.create({
    data: {
      name: "Group A",
      goal: "Goal A",
      evaluationMethod: "Method A",
      maxParticipants: 10,
      createdBy: user1.id,
    },
  });

  const group2 = await prisma.group.create({
    data: {
      name: "Group B",
      goal: "Goal B",
      evaluationMethod: "Method B",
      maxParticipants: 5,
      createdBy: user2.id,
    },
  });

  // タスクデータの作成
  await prisma.task.create({
    data: {
      task: "Task 1",
      userId: user1.id,
      groupId: group1.id,
    },
  });

  await prisma.task.create({
    data: {
      task: "Task 2",
      userId: user2.id,
      groupId: group2.id,
    },
  });

  console.log("Database has been seeded.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
