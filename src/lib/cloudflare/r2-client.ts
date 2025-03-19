"use server";

import { env } from "@/env";
import { S3Client } from "@aws-sdk/client-s3";

import { logger } from "./upload";

// ファイル全体がサーバーサイドでのみ使用されることを示すコメント
/**
 * このファイルはサーバーサイドでのみ使用されます。
 * クライアントコンポーネントからは直接インポートしないでください。
 * 代わりにr2-client-config.tsをインポートしてください。
 */

/**
 * サーバーサイドでのみ利用できるR2サービス
 * このコードはサーバーコンポーネントからのみ呼び出されるべき
 */
export async function createR2Service() {
  // 画像アップロード機能が無効の場合は無効なサービスを返す
  if (env.ENABLE_IMAGE_UPLOAD !== "true") {
    return {
      createClient: () => {
        logger.warn("画像アップロード機能が無効なため、R2クライアントは作成されません");
        return null;
      },
      getBucketName: () => {
        logger.warn("画像アップロード機能が無効なため、バケット名は取得できません");
        return null;
      },
      getPublicUrl: () => {
        logger.warn("画像アップロード機能が無効なため、パブリックURLは取得できません");
        return null;
      },
      isEnabled: false,
    };
  }

  // R2接続に必要な環境変数が設定されているか確認
  const areCredentialsConfigured = Boolean(env.CLOUDFLARE_ACCESS_KEY_ID && env.CLOUDFLARE_SECRET_ACCESS_KEY && env.CLOUDFLARE_ACCOUNT_ID);

  // バケット名とパブリックURLを取得
  const bucketName = env.CLOUDFLARE_R2_BUCKET || null;
  const publicUrl = env.CLOUDFLARE_PUBLIC_URL || null;

  if (!areCredentialsConfigured) {
    logger.error("R2の認証情報が設定されていません");
  }

  if (!bucketName) {
    logger.error("R2バケット名が設定されていません");
  }

  return {
    createClient: () => {
      if (!areCredentialsConfigured) {
        logger.error("R2の認証情報が不足しているため、R2クライアントを作成できません");
        return null;
      }

      try {
        // S3クライアントを作成
        return new S3Client({
          region: "auto",
          endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID!,
            secretAccessKey: env.CLOUDFLARE_SECRET_ACCESS_KEY!,
          },
        });
      } catch (error) {
        logger.error("R2クライアントの作成中にエラーが発生しました", error);
        return null;
      }
    },
    getBucketName: () => bucketName,
    getPublicUrl: () => publicUrl,
    isEnabled: true,
  };
}

// 既存のAPIとの後方互換性のためのエクスポート（サーバーサイド用）
const r2Service = await createR2Service();

/**
 * R2にアクセスするためのS3クライアントを作成
 * R2はS3互換APIを提供しているため、S3クライアントで接続可能
 * 注意: このメソッドはサーバーサイドでのみ使用可能
 */
export async function createR2Client() {
  return r2Service.createClient();
}

/**
 * R2バケット名を取得
 * 注意: このメソッドはサーバーサイドでのみ使用可能
 */
export async function getR2BucketName(): Promise<string | null> {
  return r2Service.getBucketName();
}

/**
 * R2のパブリックURLを取得
 * 注意: このメソッドはサーバーサイドでのみ使用可能
 */
export async function getR2PublicUrl(): Promise<string | null> {
  return r2Service.getPublicUrl();
}
