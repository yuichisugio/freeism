import { env } from "@/env";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

import { createR2Client, getR2BucketName, getR2PublicUrl } from "./r2-client";

/**
 * 画像アップロード機能が有効かどうかを確認
 */
export function isImageUploadEnabled(): boolean {
  return env.NEXT_PUBLIC_ENABLE_IMAGE_UPLOAD === "true";
}

/**
 * 署名付きアップロードURLを生成
 * クライアントサイドからR2に直接アップロードするために使用
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
    return null;
  }

  const r2Client = createR2Client();
  const bucketName = getR2BucketName();
  const publicUrl = getR2PublicUrl();

  if (!r2Client || !bucketName) {
    console.warn("R2クライアントまたはバケット名が設定されていないため、署名付きURLを生成できません");
    return null;
  }

  // MIMEタイプから拡張子を取得
  const extension = getExtensionFromMimeType(fileType);
  if (!extension) {
    console.warn(`サポートされていないMIMEタイプです: ${fileType}`);
    return null;
  }

  // ファイル名が指定されていない場合はUUIDを生成
  const fileKey = fileName || `${uuidv4()}.${extension}`;

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
}

/**
 * MIMEタイプから拡張子を取得するヘルパー関数
 * @param mimeType MIMEタイプ
 * @returns 拡張子（ピリオドなし）
 */
function getExtensionFromMimeType(mimeType: string): string | null {
  const mimeTypeMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
  };

  return mimeTypeMap[mimeType] || null;
}

/**
 * アップロードできる画像タイプの配列
 */
export const ACCEPTED_IMAGE_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "image/avif": [".avif"],
};

/**
 * 最大ファイルサイズ（5MB）
 */
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
