import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

// レスポンスの型定義
type ErrorResponse = {
  error: string;
};

type SuccessResponse = {
  signedUrl: string;
  publicUrl: string | null;
  key: string;
};

// NextResponseのモック
vi.mock("next/server", async () => {
  const actual = await vi.importActual("next/server");
  return {
    ...actual,
    NextResponse: {
      json: vi.fn().mockImplementation((data: unknown, init?: { status?: number }) => ({
        json: async () => data,
        status: init?.status ?? 200,
      })),
    },
  };
});

// Cloudflareモジュールのモック
vi.mock("@/lib/cloudflare/upload", () => ({
  getSignedUploadUrl: vi.fn(),
}));

// 動的インポートでモックされた関数にアクセス
async function importMocks() {
  const nextServer = await import("next/server");
  const cloudflareUpload = await import("@/actions/cloudflare/upload");
  const route = await import("./route");

  return {
    NextResponse: nextServer.NextResponse,
    getSignedUploadUrl: cloudflareUpload.getSignedUploadUrl,
    POST: route.POST,
  };
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return error when contentType is missing", async () => {
    const { POST, NextResponse } = await importMocks();

    // リクエストボディにcontentTypeが含まれていない場合のテスト
    const request = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: JSON.stringify({}),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const data = (await response.json()) as ErrorResponse;

    expect(response.status).toBe(400);
    expect(data.error).toBe("Content type is required");
    expect(NextResponse.json).toHaveBeenCalledWith({ error: "Content type is required" }, { status: 400 });
  });

  test("should return error when contentType is empty string", async () => {
    const { POST, NextResponse } = await importMocks();

    // contentTypeが空文字列の場合のテスト
    const request = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: JSON.stringify({ contentType: "" }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const data = (await response.json()) as ErrorResponse;

    expect(response.status).toBe(400);
    expect(data.error).toBe("Content type is required");
    expect(NextResponse.json).toHaveBeenCalledWith({ error: "Content type is required" }, { status: 400 });
  });

  test("should return signed URL when request is valid", async () => {
    const { POST, NextResponse, getSignedUploadUrl } = await importMocks();

    // 正常なレスポンスデータをモック
    const mockSignedUrlData = {
      signedUrl: "https://example.com/signed-upload-url",
      publicUrl: "https://example.com/public-url",
      key: "test-key-123",
    };

    vi.mocked(getSignedUploadUrl).mockResolvedValue(mockSignedUrlData);

    // 有効なcontentTypeでのリクエスト
    const request = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: JSON.stringify({ contentType: "image/jpeg" }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const data = (await response.json()) as SuccessResponse;

    expect(response.status).toBe(200);
    expect(data).toStrictEqual(mockSignedUrlData);
    expect(getSignedUploadUrl).toHaveBeenCalledWith("image/jpeg");
    expect(NextResponse.json).toHaveBeenCalledWith(mockSignedUrlData);
  });

  test("should return error when getSignedUploadUrl returns null", async () => {
    const { POST, NextResponse, getSignedUploadUrl } = await importMocks();

    // getSignedUploadUrlがnullを返すようにモック
    vi.mocked(getSignedUploadUrl).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: JSON.stringify({ contentType: "image/jpeg" }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const data = (await response.json()) as ErrorResponse;

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to generate signed URL");
    expect(getSignedUploadUrl).toHaveBeenCalledWith("image/jpeg");
    expect(NextResponse.json).toHaveBeenCalledWith({ error: "Failed to generate signed URL" }, { status: 500 });
  });

  test("should return error when exception occurs during processing", async () => {
    const { POST, NextResponse, getSignedUploadUrl } = await importMocks();

    // getSignedUploadUrlで例外が発生するようにモック
    vi.mocked(getSignedUploadUrl).mockRejectedValue(new Error("Test error"));

    const request = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: JSON.stringify({ contentType: "image/jpeg" }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const data = (await response.json()) as ErrorResponse;

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
    expect(getSignedUploadUrl).toHaveBeenCalledWith("image/jpeg");
    expect(NextResponse.json).toHaveBeenCalledWith({ error: "Internal server error" }, { status: 500 });
  });

  test("should return error when request body is invalid JSON", async () => {
    const { POST, NextResponse } = await importMocks();

    // 不正なJSONのリクエスト
    const request = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: "invalid json",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const data = (await response.json()) as ErrorResponse;

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
    expect(NextResponse.json).toHaveBeenCalledWith({ error: "Internal server error" }, { status: 500 });
  });
});
