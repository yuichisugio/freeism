import { NextResponse } from "next/server";

// 認証が必要なパスを設定
export const config = {
  matcher: ["/dashboard/:path*", "/protected/:path*"],
};

export async function middleware(request: Request) {
  console.log("middleware");

  // Cookieヘッダーを取得
  const cookieHeader = request.headers.get("cookie") || "";
  console.log("cookieHeader: ", cookieHeader);

  // Auth.js/NextAuth.jsの可能性のあるすべてのセッションCookie名をチェック
  const possibleCookieNames = [
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "__Host-next-auth.session-token",
    "next-auth.callback-url",
    "__Secure-next-auth.callback-url",
    "next-auth.csrf-token",
    "__Host-next-auth.csrf-token",
    // Auth.js v5での可能性のある名前
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "__Host-authjs.session-token",
  ];

  // 個別の各Cookieを抽出して確認（より正確な方法）
  const cookies = parseCookies(cookieHeader);
  console.log("Parsed cookies:", cookies);

  // いずれかのセッションCookieが存在するか確認
  let hasSession = false;
  for (const name of possibleCookieNames) {
    if (cookies[name]) {
      console.log(`Found session cookie: ${name}`);
      hasSession = true;
      break;
    }
  }

  // もしCookieのパースができなかった場合のバックアップとして、単純な文字列検索も行う
  if (!hasSession) {
    for (const name of possibleCookieNames) {
      if (cookieHeader.includes(`${name}=`)) {
        console.log(`Found session cookie via string search: ${name}`);
        hasSession = true;
        break;
      }
    }
  }

  console.log("hasSession: ", hasSession);

  // セッションCookieが存在しない場合はログインページにリダイレクト
  if (!hasSession) {
    const url = new URL("/auth/signin", request.url);
    url.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Cookie文字列をパースするヘルパー関数
function parseCookies(cookieHeader: string) {
  const cookies: Record<string, string> = {};

  if (!cookieHeader) return cookies;

  const cookiePairs = cookieHeader.split(";");
  for (const cookiePair of cookiePairs) {
    const [name, ...valueParts] = cookiePair.trim().split("=");
    // valuePartsは「=」で分割された後の部分すべてを結合（値に「=」が含まれる可能性があるため）
    const value = valueParts.join("=");
    if (name) {
      cookies[name] = value;
    }
  }

  return cookies;
}
