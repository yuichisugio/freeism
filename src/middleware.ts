// middleware.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";

// 認証が必要なパスを設定
// 認証が必要なパスを設定
export const config = {
  matcher: [
    // 特定の保護されたルート
    "/dashboard/:path*",
    "/protected/user/:path*",
    // 特定のパターンにのみマッチ（ルートパスを除外）
    "/((?!^/$|api|_next/static|_next/image|favicon.ico|auth).+)",
  ],
};

export const middleware = auth((req) => {
  try {
    // 現在のパスを取得
    const pathname = new URL(req.url).pathname;

    // ルートパス「/」の場合は認証をスキップ
    if (pathname === "/") {
      return NextResponse.next();
    }

    const isLoggedIn = !!req.auth;

    if (!isLoggedIn) {
      const url = new URL("/auth/signin", req.url);
      // 相対パスを使用してURLエンコーディングを簡略化
      url.searchParams.set("callbackUrl", new URL(req.url).pathname);
      return NextResponse.redirect(url);
    }
    // 認証済みの場合は次の処理に進む
    const response = NextResponse.next();

    // セキュリティとキャッシュのヘッダーを設定。キャッシュ制御。クリックジャッキング防止。コンテンツタイプスニッフィング防止。HTTPS強制。リファラーポリシー設定
    response.headers.set("Cache-Control", "private, no-store");
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
