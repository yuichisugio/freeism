"use server";

import { env } from "@/env";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

import { createR2Client, getR2BucketName, getR2PublicUrl } from "./r2-client";
import { ImageMimeType, logger } from "./upload";

/**
 * MIMEタイプから拡張子を取得するヘルパー関数
 * @param mimeType MIMEタイプ
 * @returns 拡張子（ピリオドなし）
 */
function getExtensionFromMimeType(mimeType: string): string | null {
  const mimeTypeMap: Record<string, string> = {
    [ImageMimeType.JPEG]: "jpg",
    [ImageMimeType.JPG]: "jpg",
    [ImageMimeType.PNG]: "png",
    [ImageMimeType.WEBP]: "webp",
    [ImageMimeType.GIF]: "gif",
    [ImageMimeType.AVIF]: "avif",
  };

  return mimeTypeMap[mimeType] || null;
}

/**
 * サーバーサイドで署名付きURLを生成する
 * APIルートハンドラなどのサーバーコンポーネント内でのみ使用すべき
 */
export async function generateSignedUploadUrl(
  fileType: string,
  fileName?: string,
): Promise<{
  signedUrl: string;
  publicUrl: string | null;
  key: string;
} | null> {
  // 画像アップロード機能が無効の場合はnullを返す
  if (env.ENABLE_IMAGE_UPLOAD !== "true") {
    logger.warn("画像アップロード機能が無効です");
    return null;
  }

  const r2Client = await createR2Client();
  const bucketName = await getR2BucketName();
  const publicUrl = await getR2PublicUrl();

  if (!r2Client || !bucketName) {
    logger.error("R2クライアントまたはバケット名が設定されていないため、署名付きURLを生成できません");
    return null;
  }

  // MIMEタイプから拡張子を取得
  const extension = getExtensionFromMimeType(fileType);
  if (!extension) {
    logger.warn(`サポートされていないMIMEタイプです: ${fileType}`);
    return null;
  }

  // ファイル名が指定されていない場合はUUIDを生成
  const fileKey = fileName || `${uuidv4()}.${extension}`;

  try {
    // 署名付きURLを生成（有効期限15分）
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      ContentType: fileType,
    });

    const signedUrl = await getSignedUrl(r2Client, putCommand, { expiresIn: 900 });

    return {
      signedUrl,
      publicUrl: publicUrl ? `${publicUrl}/${fileKey}` : null,
      key: fileKey,
    };
  } catch (error) {
    logger.error("署名付きURLの生成中にエラーが発生しました", error);
    return null;
  }
}
