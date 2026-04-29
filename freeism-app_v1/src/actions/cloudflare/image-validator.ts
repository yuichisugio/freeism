"use server";

import { MAX_FILE_SIZE } from "@/actions/cloudflare/upload-constants";

/**
 * アップロードする画像ファイルのバリデーションを行う関数
 * @param files バリデーションを行うFileオブジェクト配列
 * @returns バリデーション結果
 */
export async function validateImageFiles(files: File[]): Promise<{ valid: boolean; error?: string }> {
  try {
    // ファイルが選択されていない場合
    if (!files || files.length === 0) {
      return { valid: false, error: "ファイルが選択されていません" };
    }

    // ファイルサイズチェック
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return {
          valid: false,
          error: `ファイルサイズが大きすぎます。10MB以下のファイルを選択してください。(${file.name})`,
        };
      }
    }

    // MIME typeチェック（画像ファイルのみ許可）
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        return {
          valid: false,
          error: `画像ファイルのみアップロード可能です。(${file.name}: ${file.type})`,
        };
      }
    }

    return { valid: true };
  } catch (error) {
    console.error("画像バリデーションエラー:", error);
    return { valid: false, error: "画像の検証中にエラーが発生しました" };
  }
}
