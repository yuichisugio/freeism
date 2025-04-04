import { NextResponse } from "next/server";
import { getRecordId, saveSubscription } from "@/app/actions/push-notification";
import { auth } from "@/auth";

// リクエストボディの型定義
type SubscriptionUpdateRequest = {
  oldEndpoint: string | null;
  newSubscription: {
    endpoint: string;
    expirationTime: number | null | undefined;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
};

/**
 * Service Workerからの購読情報更新リクエストを処理するAPI
 */
export async function POST(request: Request) {
  try {
    // リクエストボディを取得
    const body = (await request.json()) as SubscriptionUpdateRequest;
    const { oldEndpoint, newSubscription } = body;

    if (!newSubscription?.endpoint) {
      return NextResponse.json({ error: "New subscription data is missing or invalid" }, { status: 400 });
    }

    // ユーザーIDを取得
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized: User not authenticated" }, { status: 401 });
    }

    // レコードの情報を更新するために、DBに保存しているendpointからレコードIDを取得
    let recordId: string | null = null;
    if (oldEndpoint) {
      recordId = await getRecordId(oldEndpoint);
    }
    if (!recordId) {
      return NextResponse.json({ error: "Old subscription not found" }, { status: 400 });
    }

    // 新しい購読情報を保存
    const result = await saveSubscription({
      endpoint: newSubscription.endpoint,
      expirationTime: newSubscription.expirationTime,
      keys: {
        p256dh: newSubscription.keys.p256dh,
        auth: newSubscription.keys.auth,
      },
      recordId: recordId,
    });

    // 結果に基づいてレスポンスを返す
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "購読情報が更新されました",
      subscription: result,
    });
  } catch (error) {
    console.error("購読更新中にエラーが発生しました:", error);
    return NextResponse.json({ error: "購読の更新に失敗しました" }, { status: 500 });
  }
}
