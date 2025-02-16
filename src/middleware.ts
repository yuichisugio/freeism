import { NextResponse } from "next/server";
import { auth } from "@/auth";

// 認証が必要なパスを設定
export const config = {
  matcher: ["/dashboard/:path*", "/protected/:path*"],
};

export async function middleware(_request: Request) {
  const session = await auth();

  // 認証されていない場合は、サインインページにリダイレクト
  if (!session) {
    return NextResponse.redirect(
      new URL("/auth/signin", "http://localhost:3000"),
    );
  }

  return NextResponse.next();
}
