import * as fs from "fs";
import * as path from "path";

/**
 * このスクリプトは、バックアップしたマイグレーションファイルを復元します。
 * マイグレーションが正常に適用された後で実行してください。
 */
async function main() {
  try {
    console.log("マイグレーションファイルを復元中...");

    const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
    const originalDir = path.join(migrationsDir, "20250308141629_add_model_original");
    const targetDir = path.join(migrationsDir, "20250308141629_add_model");

    // 元のディレクトリが存在するか確認
    if (!fs.existsSync(originalDir)) {
      console.log("元のマイグレーションディレクトリが見つかりません。");
      return;
    }

    // ターゲットディレクトリが既に存在する場合は削除
    if (fs.existsSync(targetDir)) {
      console.log("ターゲットディレクトリを削除します。");
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    // マイグレーションディレクトリを復元
    console.log("マイグレーションディレクトリを復元します。");
    fs.renameSync(originalDir, targetDir);

    console.log("マイグレーションファイルの復元が完了しました。");
  } catch (error) {
    console.error("エラーが発生しました:", error);
  }
}

main().catch((error) => {
  console.error("トップレベルエラー:", error);
  process.exit(1);
});
