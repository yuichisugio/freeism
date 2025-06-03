import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { POST } from "./route";

// vi.hoisted()を使用してモック関数を定義
const { mockGenerateSignedUploadUrl, mockNextResponseJson } = vi.hoisted(() => ({
  mockGenerateSignedUploadUrl: vi.fn(),
  mockNextResponseJson: vi.fn(),
}));

vi.mock("@/lib/cloudflare/upload-server", () => ({
  generateSignedUploadUrl: mockGenerateSignedUploadUrl,
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual("next/server");
  return {
    ...actual,
    NextResponse: {
      json: mockNextResponseJson,
    },
  };
});

// レスポンスデータの型定義
type SignedUrlResponse = {
  signedUrl: string;
  publicUrl: string;
  key: string;
};

type ErrorResponse = {
  error: string;
};

describe("API /api/upload/get-signed-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    test("should generate signed URL successfully with valid fileType", async () => {
      // Arrange
      const mockSignedUrlData: SignedUrlResponse = {
        signedUrl: "https://test-signed-url.example.com",
        publicUrl: "https://test-public-url.example.com/test-file.jpg",
        key: "test-file.jpg",
      };

      mockGenerateSignedUploadUrl.mockResolvedValue(mockSignedUrlData);

      const mockResponse = {
        status: 200,
        json: vi.fn().mockResolvedValue(mockSignedUrlData),
      };
      mockNextResponseJson.mockReturnValue(mockResponse);

      const requestBody = {
        fileType: "image/jpeg",
        fileName: "test-file.jpg",
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(requestBody),
      } as Partial<NextRequest> as NextRequest;

      // Act
      const response = await POST(mockRequest);
      const responseData = (await response.json()) as SignedUrlResponse;

      // Assert
      expect(response.status).toBe(200);
      expect(responseData).toStrictEqual(mockSignedUrlData);
      expect(mockGenerateSignedUploadUrl).toHaveBeenCalledWith("image/jpeg", "test-file.jpg");
      expect(mockNextResponseJson).toHaveBeenCalledWith(mockSignedUrlData);
    });

    test("should generate signed URL successfully without fileName", async () => {
      // Arrange
      const mockSignedUrlData: SignedUrlResponse = {
        signedUrl: "https://test-signed-url.example.com",
        publicUrl: "https://test-public-url.example.com/generated-uuid.png",
        key: "generated-uuid.png",
      };

      mockGenerateSignedUploadUrl.mockResolvedValue(mockSignedUrlData);

      const mockResponse = {
        status: 200,
        json: vi.fn().mockResolvedValue(mockSignedUrlData),
      };
      mockNextResponseJson.mockReturnValue(mockResponse);

      const requestBody = {
        fileType: "image/png",
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(requestBody),
      } as Partial<NextRequest> as NextRequest;

      // Act
      const response = await POST(mockRequest);
      const responseData = (await response.json()) as SignedUrlResponse;

      // Assert
      expect(response.status).toBe(200);
      expect(responseData).toStrictEqual(mockSignedUrlData);
      expect(mockGenerateSignedUploadUrl).toHaveBeenCalledWith("image/png", undefined);
    });

    test("should handle various supported MIME types", async () => {
      const testCases = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];

      for (const mimeType of testCases) {
        vi.clearAllMocks();

        const mockSignedUrlData: SignedUrlResponse = {
          signedUrl: "https://test-signed-url.example.com",
          publicUrl: "https://test-public-url.example.com/test-file",
          key: "test-file",
        };

        mockGenerateSignedUploadUrl.mockResolvedValue(mockSignedUrlData);

        const mockResponse = {
          status: 200,
          json: vi.fn().mockResolvedValue(mockSignedUrlData),
        };
        mockNextResponseJson.mockReturnValue(mockResponse);

        const requestBody = {
          fileType: mimeType,
        };

        const mockRequest = {
          json: vi.fn().mockResolvedValue(requestBody),
        } as Partial<NextRequest> as NextRequest;

        // Act
        const response = await POST(mockRequest);
        const responseData = (await response.json()) as SignedUrlResponse;

        // Assert
        expect(response.status).toBe(200);
        expect(responseData).toStrictEqual(mockSignedUrlData);
        expect(mockGenerateSignedUploadUrl).toHaveBeenCalledWith(mimeType, undefined);
      }
    });

    test("should handle empty fileName properly", async () => {
      // Arrange
      const mockSignedUrlData: SignedUrlResponse = {
        signedUrl: "https://test-signed-url.example.com",
        publicUrl: "https://test-public-url.example.com/generated-uuid.jpg",
        key: "generated-uuid.jpg",
      };

      mockGenerateSignedUploadUrl.mockResolvedValue(mockSignedUrlData);

      const mockResponse = {
        status: 200,
        json: vi.fn().mockResolvedValue(mockSignedUrlData),
      };
      mockNextResponseJson.mockReturnValue(mockResponse);

      const requestBody = {
        fileType: "image/jpeg",
        fileName: "",
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(requestBody),
      } as Partial<NextRequest> as NextRequest;

      // Act
      const response = await POST(mockRequest);
      const responseData = (await response.json()) as SignedUrlResponse;

      // Assert
      expect(response.status).toBe(200);
      expect(responseData).toStrictEqual(mockSignedUrlData);
      expect(mockGenerateSignedUploadUrl).toHaveBeenCalledWith("image/jpeg", "");
    });
  });

  describe("異常系 - バリデーションエラー", () => {
    test("should return 400 error when fileType is missing", async () => {
      // Arrange
      const mockErrorResponse = {
        status: 400,
        json: vi.fn().mockResolvedValue({ error: "fileTypeは必須です" }),
      };
      mockNextResponseJson.mockReturnValue(mockErrorResponse);

      const requestBody = {};

      const mockRequest = {
        json: vi.fn().mockResolvedValue(requestBody),
      } as Partial<NextRequest> as NextRequest;

      // Act
      const response = await POST(mockRequest);
      const responseData = (await response.json()) as ErrorResponse;

      // Assert
      expect(response.status).toBe(400);
      expect(responseData).toStrictEqual({ error: "fileTypeは必須です" });
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: "fileTypeは必須です" }, { status: 400 });
      expect(mockGenerateSignedUploadUrl).not.toHaveBeenCalled();
    });

    test("should return 400 error when fileType is empty string", async () => {
      // Arrange
      const mockErrorResponse = {
        status: 400,
        json: vi.fn().mockResolvedValue({ error: "fileTypeは必須です" }),
      };
      mockNextResponseJson.mockReturnValue(mockErrorResponse);

      const requestBody = {
        fileType: "",
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(requestBody),
      } as Partial<NextRequest> as NextRequest;

      // Act
      const response = await POST(mockRequest);
      const responseData = (await response.json()) as ErrorResponse;

      // Assert
      expect(response.status).toBe(400);
      expect(responseData).toStrictEqual({ error: "fileTypeは必須です" });
      expect(mockGenerateSignedUploadUrl).not.toHaveBeenCalled();
    });

    test("should return 400 error when fileType is null", async () => {
      // Arrange
      const mockErrorResponse = {
        status: 400,
        json: vi.fn().mockResolvedValue({ error: "fileTypeは必須です" }),
      };
      mockNextResponseJson.mockReturnValue(mockErrorResponse);

      const requestBody = {
        fileType: null,
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(requestBody),
      } as Partial<NextRequest> as NextRequest;

      // Act
      const response = await POST(mockRequest);
      const responseData = (await response.json()) as ErrorResponse;

      // Assert
      expect(response.status).toBe(400);
      expect(responseData).toStrictEqual({ error: "fileTypeは必須です" });
      expect(mockGenerateSignedUploadUrl).not.toHaveBeenCalled();
    });

    test("should return 400 error when fileType is undefined", async () => {
      // Arrange
      const mockErrorResponse = {
        status: 400,
        json: vi.fn().mockResolvedValue({ error: "fileTypeは必須です" }),
      };
      mockNextResponseJson.mockReturnValue(mockErrorResponse);

      const requestBody = {
        fileType: undefined,
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(requestBody),
      } as Partial<NextRequest> as NextRequest;

      // Act
      const response = await POST(mockRequest);
      const responseData = (await response.json()) as ErrorResponse;

      // Assert
      expect(response.status).toBe(400);
      expect(responseData).toStrictEqual({ error: "fileTypeは必須です" });
      expect(mockGenerateSignedUploadUrl).not.toHaveBeenCalled();
    });
  });

  describe("異常系 - サーバーエラー", () => {
    test("should return 500 error when generateSignedUploadUrl returns null", async () => {
      // Arrange
      mockGenerateSignedUploadUrl.mockResolvedValue(null);

      const mockErrorResponse = {
        status: 500,
        json: vi.fn().mockResolvedValue({ error: "署名付きURLの生成に失敗しました" }),
      };
      mockNextResponseJson.mockReturnValue(mockErrorResponse);

      const requestBody = {
        fileType: "image/jpeg",
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(requestBody),
      } as Partial<NextRequest> as NextRequest;

      // Act
      const response = await POST(mockRequest);
      const responseData = (await response.json()) as ErrorResponse;

      // Assert
      expect(response.status).toBe(500);
      expect(responseData).toStrictEqual({ error: "署名付きURLの生成に失敗しました" });
      expect(mockGenerateSignedUploadUrl).toHaveBeenCalledWith("image/jpeg", undefined);
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: "署名付きURLの生成に失敗しました" }, { status: 500 });
    });

    test("should return 500 error when JSON parsing fails", async () => {
      // Arrange
      const mockErrorResponse = {
        status: 500,
        json: vi.fn().mockResolvedValue({ error: "内部サーバーエラー" }),
      };
      mockNextResponseJson.mockReturnValue(mockErrorResponse);

      const mockRequest = {
        json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
      } as Partial<NextRequest> as NextRequest;

      // Act
      const response = await POST(mockRequest);
      const responseData = (await response.json()) as ErrorResponse;

      // Assert
      expect(response.status).toBe(500);
      expect(responseData).toStrictEqual({ error: "内部サーバーエラー" });
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: "内部サーバーエラー" }, { status: 500 });
      expect(mockGenerateSignedUploadUrl).not.toHaveBeenCalled();
    });

    test("should return 500 error when generateSignedUploadUrl throws an error", async () => {
      // Arrange
      const mockError = new Error("Database connection failed");
      mockGenerateSignedUploadUrl.mockRejectedValue(mockError);

      const mockErrorResponse = {
        status: 500,
        json: vi.fn().mockResolvedValue({ error: "内部サーバーエラー" }),
      };
      mockNextResponseJson.mockReturnValue(mockErrorResponse);

      const requestBody = {
        fileType: "image/jpeg",
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(requestBody),
      } as Partial<NextRequest> as NextRequest;

      // Act
      const response = await POST(mockRequest);
      const responseData = (await response.json()) as ErrorResponse;

      // Assert
      expect(response.status).toBe(500);
      expect(responseData).toStrictEqual({ error: "内部サーバーエラー" });
      expect(mockGenerateSignedUploadUrl).toHaveBeenCalledWith("image/jpeg", undefined);
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: "内部サーバーエラー" }, { status: 500 });
    });

    test("should handle non-Error exceptions", async () => {
      // Arrange
      const mockError = "String error message";
      mockGenerateSignedUploadUrl.mockRejectedValue(mockError);

      const mockErrorResponse = {
        status: 500,
        json: vi.fn().mockResolvedValue({ error: "内部サーバーエラー" }),
      };
      mockNextResponseJson.mockReturnValue(mockErrorResponse);

      const requestBody = {
        fileType: "image/jpeg",
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(requestBody),
      } as Partial<NextRequest> as NextRequest;

      // Act
      const response = await POST(mockRequest);
      const responseData = (await response.json()) as ErrorResponse;

      // Assert
      expect(response.status).toBe(500);
      expect(responseData).toStrictEqual({ error: "内部サーバーエラー" });
    });
  });

  describe("エッジケース", () => {
    test("should handle request body with extra properties", async () => {
      // Arrange
      const mockSignedUrlData: SignedUrlResponse = {
        signedUrl: "https://test-signed-url.example.com",
        publicUrl: "https://test-public-url.example.com/test-file.jpg",
        key: "test-file.jpg",
      };

      mockGenerateSignedUploadUrl.mockResolvedValue(mockSignedUrlData);

      const mockResponse = {
        status: 200,
        json: vi.fn().mockResolvedValue(mockSignedUrlData),
      };
      mockNextResponseJson.mockReturnValue(mockResponse);

      const requestBody = {
        fileType: "image/jpeg",
        fileName: "test-file.jpg",
        extraProperty: "should be ignored",
        anotherProperty: 123,
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(requestBody),
      } as Partial<NextRequest> as NextRequest;

      // Act
      const response = await POST(mockRequest);
      const responseData = (await response.json()) as SignedUrlResponse;

      // Assert
      expect(response.status).toBe(200);
      expect(responseData).toStrictEqual(mockSignedUrlData);
      expect(mockGenerateSignedUploadUrl).toHaveBeenCalledWith("image/jpeg", "test-file.jpg");
    });

    test("should handle very long fileName", async () => {
      // Arrange
      const longFileName = "a".repeat(1000) + ".jpg";
      const mockSignedUrlData: SignedUrlResponse = {
        signedUrl: "https://test-signed-url.example.com",
        publicUrl: "https://test-public-url.example.com/" + longFileName,
        key: longFileName,
      };

      mockGenerateSignedUploadUrl.mockResolvedValue(mockSignedUrlData);

      const mockResponse = {
        status: 200,
        json: vi.fn().mockResolvedValue(mockSignedUrlData),
      };
      mockNextResponseJson.mockReturnValue(mockResponse);

      const requestBody = {
        fileType: "image/jpeg",
        fileName: longFileName,
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(requestBody),
      } as Partial<NextRequest> as NextRequest;

      // Act
      const response = await POST(mockRequest);
      const responseData = (await response.json()) as SignedUrlResponse;

      // Assert
      expect(response.status).toBe(200);
      expect(responseData).toStrictEqual(mockSignedUrlData);
      expect(mockGenerateSignedUploadUrl).toHaveBeenCalledWith("image/jpeg", longFileName);
    });

    test("should handle special characters in fileName", async () => {
      // Arrange
      const specialFileName = "test-file_日本語(特殊文字)@#$%.jpg";
      const mockSignedUrlData: SignedUrlResponse = {
        signedUrl: "https://test-signed-url.example.com",
        publicUrl: "https://test-public-url.example.com/" + specialFileName,
        key: specialFileName,
      };

      mockGenerateSignedUploadUrl.mockResolvedValue(mockSignedUrlData);

      const mockResponse = {
        status: 200,
        json: vi.fn().mockResolvedValue(mockSignedUrlData),
      };
      mockNextResponseJson.mockReturnValue(mockResponse);

      const requestBody = {
        fileType: "image/jpeg",
        fileName: specialFileName,
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(requestBody),
      } as Partial<NextRequest> as NextRequest;

      // Act
      const response = await POST(mockRequest);
      const responseData = (await response.json()) as SignedUrlResponse;

      // Assert
      expect(response.status).toBe(200);
      expect(responseData).toStrictEqual(mockSignedUrlData);
      expect(mockGenerateSignedUploadUrl).toHaveBeenCalledWith("image/jpeg", specialFileName);
    });
  });
});
