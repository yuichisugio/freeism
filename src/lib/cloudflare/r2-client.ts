import { env } from "@/env";
import { S3Client } from "@aws-sdk/client-s3";

/**
 * R2にアクセスするためのS3クライアントを作成
 * R2はS3互換APIを提供しているため、S3クライアントで接続可能
 */
export function createR2Client() {
  // 画像アップロード機能が無効の場合はnullを返す
  if (env.ENABLE_IMAGE_UPLOAD !== "true") {
    return null;
  }

  // 必要な設定が不足している場合はnullを返す
  if (!env.CLOUDFLARE_ACCESS_KEY_ID || !env.CLOUDFLARE_SECRET_ACCESS_KEY || !env.CLOUDFLARE_ACCOUNT_ID) {
    console.warn("R2の設定情報が不足しているため、R2クライアントを作成できません");
    return null;
  }

  // S3クライアントを作成
  return new S3Client({
    region: "auto",
    endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID,
      secretAccessKey: env.CLOUDFLARE_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * R2バケット名を取得
 */
export function getR2BucketName(): string | null {
  // 画像アップロード機能が無効の場合はnullを返す
  if (env.ENABLE_IMAGE_UPLOAD !== "true") {
    return null;
  }

  return env.CLOUDFLARE_R2_BUCKET || null;
}

/**
 * R2のパブリックURLを取得
 */
export function getR2PublicUrl(): string | null {
  // 画像アップロード機能が無効の場合はnullを返す
  if (env.ENABLE_IMAGE_UPLOAD !== "true") {
    return null;
  }

  return env.CLOUDFLARE_PUBLIC_URL || null;
}
