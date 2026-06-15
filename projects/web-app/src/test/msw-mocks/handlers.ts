import { http, HttpResponse } from "msw";

// APIエンドポイントのモックハンドラー
export const handlers = [
  // 認証関連のモック
  http.get("/api/auth/session", () => {
    return HttpResponse.json({
      user: {
        id: "test-user-id",
        email: "test@example.com",
        name: "Test User",
      },
    });
  }),

  // その他のAPIエンドポイントのモック
  http.get("/api/test", () => {
    return HttpResponse.json({
      message: "Test API response",
      status: "success",
    });
  }),
];
