"use server";

import { logger } from "./logger";

const isImageUploadEnabled = () => {
  return process.env.ENABLE_IMAGE_UPLOAD === "true";
};

// Cloudflare APIレスポンスの型定義
type CloudflareResponse = {
  result?: {
    id?: string;
    variants?: string[];
  };
  success: boolean;
  errors?: Array<{
    code: number;
    message: string;
  }>;
};

// 署名付きURLレスポンスの型定義
type SignedUrlResponse = {
  signedUrl: string;
  publicUrl: string | null;
  key: string;
};

/**
 * Cloudflareにファイルをアップロードする関数
 * @param file アップロードするファイル
 * @param options アップロードオプション
 * @returns アップロード結果
 */
export async function uploadFile(file: File, options?: { path?: string; filename?: string }): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    if (!process.env.CLOUDFLARE_ENDPOINT || !process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) {
      console.error("Cloudflare環境変数が設定されていません");
      return { success: false, error: "ストレージ設定が不完全です" };
    }

    // ここにCloudflare Images APIを使用したファイルアップロード処理を実装
    // 以下は例示用のコードです
    const formData = new FormData();
    formData.append("file", file);

    if (options?.path) {
      formData.append("path", options.path);
    }

    if (options?.filename) {
      formData.append("filename", options.filename);
    }

    const endpoint = `${process.env.CLOUDFLARE_ENDPOINT}/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/images/v1`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      },
      body: formData,
    });

    const data = (await response.json()) as CloudflareResponse;

    if (!response.ok) {
      console.error("Cloudflareアップロードエラー:", data);
      return { success: false, error: data.errors?.[0]?.message ?? "アップロードエラー" };
    }

    return {
      success: true,
      url: data.result?.variants?.[0] ?? "",
    };
  } catch (error) {
    console.error("ファイルアップロードエラー:", error);
    return { success: false, error: "アップロード処理中にエラーが発生しました" };
  }
}

/**
 * 署名付きアップロードURLを生成するためのAPIエンドポイントを呼び出す
 * @param fileType アップロードするファイルのMIMEタイプ
 * @param fileName オプションのファイル名（指定しない場合はUUIDを生成）
 * @returns 署名付きURLと、アップロード後のパブリックURLのオブジェクト
 */
export async function getSignedUploadUrl(
  fileType: string,
  fileName?: string,
): Promise<{
  signedUrl: string;
  publicUrl: string | null;
  key: string;
} | null> {
  // 画像アップロード機能が無効の場合はnullを返す
  if (!isImageUploadEnabled()) {
    logger.warn("画像アップロード機能が無効です");
    return null;
  }

  try {
    // APIエンドポイントを呼び出す
    const response = await fetch("/api/upload/get-signed-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileType,
        fileName,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as { message?: string };
      throw new Error(errorData.message ?? "署名付きURLの取得に失敗しました");
    }

    return (await response.json()) as SignedUrlResponse;
  } catch (error) {
    logger.error("署名付きURLの取得中にエラーが発生しました", error instanceof Error ? error.message : String(error));
    return null;
  }
}
