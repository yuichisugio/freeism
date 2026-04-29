import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRecordId, saveSubscription } from "@/actions/notification/push-notification";
import { getAuthSession } from "@/lib/utils";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * リクエストボディの型定義
 */
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Service Workerからの購読情報更新リクエストを処理するAPI
 */
export async function POST(req: NextRequest) {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 認証セッションを取得
     */
    const session = await getAuthSession();

    // リクエストボディを取得
    const body = (await req.json()) as SubscriptionUpdateRequest;
    const { oldEndpoint, newSubscription } = body;

    if (!newSubscription?.endpoint) {
      return NextResponse.json({ error: "New subscription data is missing or invalid" }, { status: 400 });
    }

    // ユーザーIDを取得
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized: User not authenticated" }, { status: 401 });
    }

    // レコードの情報を更新するために、DBに保存しているendpointからレコードIDを取得
    let recordId: string | null = null;
    if (oldEndpoint) {
      const result = await getRecordId(oldEndpoint);
      if (result.success && result.data) {
        recordId = result.data;
      } else {
        return NextResponse.json({ error: "Old subscription not found" }, { status: 400 });
      }
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
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "購読情報が更新されました",
      subscription: result.data,
    });
  } catch (error) {
    console.error("購読更新中にエラーが発生しました:", error);
    return NextResponse.json({ error: "購読の更新に失敗しました" }, { status: 500 });
  }
}
