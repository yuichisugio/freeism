import { PrismaClient } from "@prisma/client";

/**
 * このスクリプトは、失敗したバックアップマイグレーションのステータスを修正します。
 * 具体的には、_prisma_migrationsテーブルから問題のあるバックアップマイグレーションの
 * エントリを削除します。
 */
async function main() {
  const prisma = new PrismaClient();

  try {
    console.log("失敗したバックアップマイグレーションエラーを修正中...");

    // 問題のあるマイグレーション名
    const failed_backup_migration_name = "20250308141629_add_model_backup";

    // マイグレーションのステータスを確認
    const checkMigration = await prisma.$queryRaw`
      SELECT * FROM "_prisma_migrations" WHERE "migration_name" = ${failed_backup_migration_name};
    `;

    console.log("修正対象のバックアップマイグレーション:", checkMigration);

    if (Array.isArray(checkMigration) && checkMigration.length > 0) {
      // このマイグレーションをデータベースから削除
      const deleteResult = await prisma.$executeRaw`
        DELETE FROM "_prisma_migrations" WHERE "migration_name" = ${failed_backup_migration_name};
      `;

      console.log(`マイグレーション "${failed_backup_migration_name}" のレコードを削除しました。結果:`, deleteResult);
      console.log("マイグレーションのリセットが完了しました。");
    } else {
      console.log(`マイグレーション "${failed_backup_migration_name}" は見つかりませんでした。`);
    }

    // 元のマイグレーション（すでに解決済みとマークされている）も確認
    const original_migration_name = "20250308141629_add_model";
    const checkOriginalMigration = await prisma.$queryRaw`
      SELECT * FROM "_prisma_migrations" WHERE "migration_name" = ${original_migration_name};
    `;

    console.log("元のマイグレーション:", checkOriginalMigration);

    console.log("次のコマンドを実行してマイグレーションを適用してください:");
    console.log("pnpm prisma migrate deploy");
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
