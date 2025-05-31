import { http, HttpResponse } from "msw";

// APIエンドポイントのモックハンドラー
export const handlers = [
  // GraphQL APIのモック
  http.post("/api/graphql", () => {
    return HttpResponse.json({
      data: {
        // デフォルトのGraphQLレスポンス
        message: "Mock GraphQL response",
      },
    });
  }),

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

  // ファイルアップロードのモック
  http.post("/api/upload", () => {
    return HttpResponse.json({
      url: "https://example.com/test-image.jpg",
      success: true,
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
