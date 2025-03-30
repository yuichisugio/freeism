import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSignedUploadUrl } from "@/lib/cloudflare/upload";

/**
 * 署名付きアップロードURLを生成するAPI
 * @param req リクエスト
 */
export async function POST(req: NextRequest) {
  try {
    // リクエストボディから必要な情報を取得
    const data = (await req.json()) as { contentType: string };
    const { contentType } = data;

    if (!contentType) {
      return NextResponse.json({ error: "Content type is required" }, { status: 400 });
    }

    // 署名付きURLを生成
    const signedUrlData = await getSignedUploadUrl(contentType);

    if (!signedUrlData) {
      return NextResponse.json({ error: "Failed to generate signed URL" }, { status: 500 });
    }

    return NextResponse.json(signedUrlData);
  } catch (error) {
    console.error("署名付きURL生成エラー:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
