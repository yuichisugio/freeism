import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// 認証が必要なパスを設定
export const config = {
  matcher: ["/dashboard/:path*", "/protected/:path*"],
};

export async function middleware(_request: Request) {
  // JWTトークンを直接取得（Prismaアダプターを使わない）
  const token = await getToken({
    req: _request as any,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // 認証されていない場合は、サインインページにリダイレクト
  if (!token) {
    const url = new URL("/auth/signin", _request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
