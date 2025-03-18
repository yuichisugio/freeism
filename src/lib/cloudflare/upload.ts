import { env } from "@/env";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

import { createR2Client, getR2BucketName, getR2PublicUrl } from "./r2-client";

// 画像MIMEタイプの列挙型
export enum ImageMimeType {
  JPEG = "image/jpeg",
  JPG = "image/jpg",
  PNG = "image/png",
  WEBP = "image/webp",
  GIF = "image/gif",
  AVIF = "image/avif",
}

// 画像拡張子の列挙型。列挙型は、列挙型の名前.プロパティ名でアクセスする。
export enum ImageExtension {
  JPEG = "jpg",
  JPG = "jpg",
  PNG = "png",
  WEBP = "webp",
  GIF = "gif",
  AVIF = "avif",
}

// 共通のロギング関数
export const logger = {
  warn: (message: string, ...args: any[]) => {
    console.warn(`[R2 Service] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[R2 Service] ${message}`, ...args);
  },
  info: (message: string, ...args: any[]) => {
    console.info(`[R2 Service] ${message}`, ...args);
  },
};

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
    logger.warn("画像アップロード機能が無効です");
    return null;
  }

  const r2Client = createR2Client();
  const bucketName = getR2BucketName();
  const publicUrl = getR2PublicUrl();

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

/**
 * MIMEタイプから拡張子を取得するヘルパー関数
 * @param mimeType MIMEタイプ
 * @returns 拡張子（ピリオドなし）
 */
function getExtensionFromMimeType(mimeType: string): string | null {
  const mimeTypeMap: Record<string, string> = {
    [ImageMimeType.JPEG]: ImageExtension.JPEG,
    [ImageMimeType.JPG]: ImageExtension.JPG,
    [ImageMimeType.PNG]: ImageExtension.PNG,
    [ImageMimeType.WEBP]: ImageExtension.WEBP,
    [ImageMimeType.GIF]: ImageExtension.GIF,
    [ImageMimeType.AVIF]: ImageExtension.AVIF,
  };

  return mimeTypeMap[mimeType] || null;
}

/**
 * アップロードできる画像タイプの配列
 */
export const ACCEPTED_IMAGE_TYPES: Record<ImageMimeType, string[]> = {
  [ImageMimeType.JPEG]: [".jpg", ".jpeg"],
  [ImageMimeType.JPG]: [".jpg", ".jpeg"],
  [ImageMimeType.PNG]: [".png"],
  [ImageMimeType.WEBP]: [".webp"],
  [ImageMimeType.GIF]: [".gif"],
  [ImageMimeType.AVIF]: [".avif"],
};

/**
 * 最大ファイルサイズ（5MB）
 */
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
