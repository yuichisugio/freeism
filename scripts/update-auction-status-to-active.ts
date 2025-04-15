#!/usr/bin/env ts-node
/**
 * オークションのステータスを更新するスクリプト
 * GitHub Actionsから実行するためのスクリプトです
 * .js拡張子をつけているのは、GitHub Actionsでは.ts拡張子が認識されないためです
 */
import { updateAuctionStatusToActive } from "../src/lib/auction/action/update-status.js";

/**
 * メイン関数
 */
async function main() {
  try {
    console.log("オークションのステータスを更新します...");

    // オークション開始処理を実行
    const updatedCount = await updateAuctionStatusToActive();

    console.log(`処理が完了しました。${updatedCount}件のオークションのステータスを更新しました。`);
    process.exit(0);
  } catch (error) {
    console.error("エラーが発生しました:", error);
    process.exit(1);
  }
}

// スクリプト実行
void main();
