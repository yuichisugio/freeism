import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();

  try {
    // マイグレーション履歴テーブルを直接クエリ
    const migrations = await prisma.$queryRaw`
      SELECT * FROM "_prisma_migrations" ORDER BY "migration_name";
    `;

    console.log("マイグレーション履歴:");
    console.log(JSON.stringify(migrations, null, 2));

    // 特定のマイグレーションの状態を確認
    const failedMigration = await prisma.$queryRaw`
      SELECT * FROM "_prisma_migrations" WHERE "migration_name" = '20250308141629_add_model';
    `;

    console.log("\n失敗したマイグレーション:");
    console.log(JSON.stringify(failedMigration, null, 2));
  } catch (error) {
    console.error("エラーが発生しました:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("トップレベルエラー:", error);
  process.exit(1);
});
