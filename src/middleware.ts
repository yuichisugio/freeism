// middleware.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";

// 認証が必要なパスを設定
export const config = {
  matcher: ["/dashboard/:path*"],
};

export const middleware = auth((req) => {
  try {
    const isLoggedIn = !!req.auth;

    if (!isLoggedIn) {
      // リクエストされたURLから具体的なパス部分のみを抽出しています。
      // 例えば、https://example.com/dashboard/profile?tab=settingsというURLの場合、pathnameは/dashboard/profileとなります。
      // この処理により、クエリパラメータやフラグメントを除いた純粋なパス情報を取得できます。
      const pathname = new URL(req.url).pathname;
      console.log("認証されていないユーザーを検出しました:", pathname);
      // 現在のドメインやプロトコルを保持しながら、それ以降のパスを/auth/signinに変更した新しいURLを作成します。これにより、異なる環境（開発環境のlocalhost、本番環境freeism）でも適切なドメインが使用されます。
      const url = new URL("/auth/signin", req.url);
      // URLパラメータを追加。callbackUrlパラメータには、ユーザーが元々アクセスしようとしていたパス（pathname）が設定されます。これにより、認証完了後に元のページにリダイレクトすることが可能になります。
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }

    // 認証済みの場合は次の処理に進む
    const response = NextResponse.next();

    // セキュリティとキャッシュのヘッダーを設定。キャッシュ制御。クリックジャッキング防止。コンテンツタイプスニッフィング防止。HTTPS強制。リファラーポリシー設定
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    return response;
  } catch (error) {
    console.error("Error in middleware:", error);
    return NextResponse.redirect(new URL("/error", req.url));
  }
});
