import * as fs from "fs";
import * as path from "path";

/**
 * このスクリプトは、問題のあるマイグレーションファイルを一時的にバックアップします。
 * マイグレーションが正常に適用された後で、バックアップを復元することが可能です。
 */
async function main() {
  try {
    console.log("マイグレーションファイルのバックアップを作成中...");

    const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
    const problemMigrationDir = path.join(migrationsDir, "20250308141629_add_model");
    const backupDir = path.join(migrationsDir, "20250308141629_add_model_backup");

    // バックアップディレクトリが既に存在するか確認
    if (fs.existsSync(backupDir)) {
      console.log("バックアップディレクトリは既に存在します。");
      return;
    }

    // 問題のあるマイグレーションディレクトリが存在するか確認
    if (!fs.existsSync(problemMigrationDir)) {
      console.log("問題のマイグレーションディレクトリが見つかりません。");
      return;
    }

    // バックアップディレクトリを作成
    fs.mkdirSync(backupDir, { recursive: true });

    // migration.sqlファイルをコピー
    const migrationSqlPath = path.join(problemMigrationDir, "migration.sql");
    const backupSqlPath = path.join(backupDir, "migration.sql");

    if (fs.existsSync(migrationSqlPath)) {
      fs.copyFileSync(migrationSqlPath, backupSqlPath);
      console.log("migration.sqlファイルをバックアップしました。");
    }

    // 問題のマイグレーションディレクトリを削除
    console.log("問題のマイグレーションディレクトリを一時的に移動します。");
    fs.renameSync(problemMigrationDir, path.join(migrationsDir, "20250308141629_add_model_original"));

    console.log("マイグレーションファイルのバックアップが完了しました。");
    console.log("次のコマンドを実行してマイグレーションを適用してください:");
    console.log("pnpm prisma migrate resolve --applied 20250308141629_add_model");
    console.log("pnpm prisma migrate deploy");
  } catch (error) {
    console.error("エラーが発生しました:", error);
  }
}

main().catch((error) => {
  console.error("トップレベルエラー:", error);
  process.exit(1);
});
