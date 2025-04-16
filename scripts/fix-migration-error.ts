import { PrismaClient } from "@prisma/client";

/**
 * このスクリプトは、失敗したマイグレーションのステータスを修正します。
 * 具体的には、_prisma_migrationsテーブルから問題のあるマイグレーションの
 * エントリを削除し、新たにマイグレーションを適用できるようにします。
 */
async function main() {
  const prisma = new PrismaClient();

  try {
    console.log("マイグレーションエラーを修正中...");

    // マイグレーションをリセットするためのフラグを設定
    // failed_migration_nameは問題のあるマイグレーション名
    const failed_migration_name = "20250308141629_add_model";

    // マイグレーションのステータスを確認
    const checkMigration = await prisma.$queryRaw`
      SELECT * FROM "_prisma_migrations" WHERE "migration_name" = ${failed_migration_name};
    `;

    console.log("修正対象のマイグレーション:", checkMigration);

    if (Array.isArray(checkMigration) && checkMigration.length > 0) {
      // このマイグレーションをデータベースから削除
      // 注意: これにより、このマイグレーションは未適用として扱われます
      const deleteResult = await prisma.$executeRaw`
        DELETE FROM "_prisma_migrations" WHERE "migration_name" = ${failed_migration_name};
      `;

      console.log(`マイグレーション "${failed_migration_name}" のレコードを削除しました。結果:`, deleteResult);

      // 修正用マイグレーション(20250308141629_add_model_fix)も既に適用されている場合は
      // 残しておく必要がある

      console.log("マイグレーションのリセットが完了しました。");
      console.log("次のコマンドを実行してマイグレーションを再適用してください:");
      console.log("pnpm prisma migrate resolve --applied 20250308141629_add_model");
    } else {
      console.log(`マイグレーション "${failed_migration_name}" は見つかりませんでした。`);
    }
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
