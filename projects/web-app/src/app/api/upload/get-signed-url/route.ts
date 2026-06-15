import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { generateSignedUploadUrl } from "@/actions/cloudflare/upload-server";

/**
 * 署名付きアップロードURLを生成するAPIエンドポイント
 */
export async function POST(request: NextRequest) {
  try {
    const data = (await request.json()) as { fileType: string; fileName?: string };
    const { fileType, fileName } = data;

    // ファイルタイプの検証
    if (!fileType) {
      return NextResponse.json({ error: "fileTypeは必須です" }, { status: 400 });
    }

    // 署名付きURLの生成
    const signedUrlData = await generateSignedUploadUrl(fileType, fileName);

    if (!signedUrlData) {
      return NextResponse.json({ error: "署名付きURLの生成に失敗しました" }, { status: 500 });
    }

    return NextResponse.json(signedUrlData);
  } catch (error) {
    console.error("署名付きURLの生成中にエラーが発生しました", error);
    return NextResponse.json({ error: "内部サーバーエラー" }, { status: 500 });
  }
}
