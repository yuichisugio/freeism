import type { GeneralNotificationParams } from "@/lib/actions/notification/general-notification";
import { NextResponse } from "next/server";
import { sendGeneralNotification } from "@/lib/actions/notification/general-notification";
import { getAuthSession } from "@/lib/utils";

/**
 * 通知を作成するAPI Route
 */
export async function POST(request: Request) {
  try {
    // セッション情報の取得
    const session = await getAuthSession();

    // 認証チェック
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "認証が必要です" }, { status: 401 });
    }

    // リクエストボディの取得
    const data = (await request.json()) as GeneralNotificationParams;

    // 通知の作成
    const result = await sendGeneralNotification(data);
    console.log("src/app/api/notifications/route.ts_POST_result", result);

    // 結果を返す
    return NextResponse.json(result);
  } catch (error) {
    console.error("通知作成エラー:", error);
    return NextResponse.json({ success: false, error: "通知の作成中にエラーが発生しました" }, { status: 500 });
  }
}
