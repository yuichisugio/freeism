import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "./auth";

// 認証が必要なパスを設定
export const config = {
  matcher: [
    /*
     * /api/trpc で始まるパスを除外（API routes）
     * /_next で始まるパスを除外（Next.js system routes）
     * /auth で始まるパスを除外（Auth routes）
     */
    "/((?!api|_next/static|_next/image|favicon.ico|auth).*)",
    "/protected/:path*",
  ],
};

export async function middleware(request: NextRequest) {
  try {
    // セッションの取得を試みる
    const session = await auth();
    const { pathname } = request.nextUrl;

    // 保護されたルートへのアクセスチェック
    if (pathname.startsWith("/protected") && !session) {
      // 未認証の場合、サインインページへリダイレクト
      const signInUrl = new URL("/auth/signin", request.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }

    // 認証済みユーザーのアクセスチェック
    if (session && pathname.startsWith("/auth")) {
      // 認証済みの場合、ホームページへリダイレクト
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  } catch (error) {
    // エラーが発生した場合はデフォルトの動作を継続
    console.error("Auth middleware error:", error);
    return NextResponse.next();
  }
}
