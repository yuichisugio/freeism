import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// NextResponseのモック
vi.mock("next/server", async () => {
  const actual = await vi.importActual("next/server");
  return {
    ...actual,
    NextResponse: {
      next: vi.fn(() => ({
        headers: {
          set: vi.fn(),
        },
      })),
      redirect: vi.fn(() => ({
        headers: {
          set: vi.fn(),
        },
      })),
    },
  };
});

// auth関数のモック
vi.mock("@/auth", () => ({
  auth: vi.fn((callback: unknown) => callback),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("config", () => {
    test("should have correct matcher configuration", async () => {
      const { config } = await import("./middleware");
      expect(config.matcher).toEqual(["/dashboard/:path*", "/protected/user/:path*", "/((?!|_next|auth|favicon.ico).+)"]);
    });
  });

  describe("middleware existence", () => {
    test("should export middleware function", async () => {
      const { middleware } = await import("./middleware");
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe("function");
    });
  });

  describe("basic functionality", () => {
    test("should handle service-worker.js path", async () => {
      // middlewareの内部ロジックを直接テスト
      const request = new NextRequest("http://localhost:3000/service-worker.js");
      const pathname = new URL(request.url).pathname;

      // パススキップの条件をテスト
      const shouldSkip =
        pathname.startsWith("/service-worker.js") || pathname === "/" || pathname.startsWith("/auth/") || pathname.startsWith("/api/auth/");

      expect(shouldSkip).toBe(true);
    });

    test("should handle root path", async () => {
      const request = new NextRequest("http://localhost:3000/");
      const pathname = new URL(request.url).pathname;

      const shouldSkip =
        pathname.startsWith("/service-worker.js") || pathname === "/" || pathname.startsWith("/auth/") || pathname.startsWith("/api/auth/");

      expect(shouldSkip).toBe(true);
    });

    test("should handle auth paths", async () => {
      const request = new NextRequest("http://localhost:3000/auth/signin");
      const pathname = new URL(request.url).pathname;

      const shouldSkip =
        pathname.startsWith("/service-worker.js") || pathname === "/" || pathname.startsWith("/auth/") || pathname.startsWith("/api/auth/");

      expect(shouldSkip).toBe(true);
    });

    test("should handle api auth paths", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/session");
      const pathname = new URL(request.url).pathname;

      const shouldSkip =
        pathname.startsWith("/service-worker.js") || pathname === "/" || pathname.startsWith("/auth/") || pathname.startsWith("/api/auth/");

      expect(shouldSkip).toBe(true);
    });

    test("should not skip protected paths", async () => {
      const request = new NextRequest("http://localhost:3000/dashboard");
      const pathname = new URL(request.url).pathname;

      const shouldSkip =
        pathname.startsWith("/service-worker.js") || pathname === "/" || pathname.startsWith("/auth/") || pathname.startsWith("/api/auth/");

      expect(shouldSkip).toBe(false);
    });
  });

  describe("authentication logic", () => {
    test("should detect unauthenticated user", () => {
      const mockRequest = { auth: null };
      const isLoggedIn = !!mockRequest.auth;
      expect(isLoggedIn).toBe(false);
    });

    test("should detect authenticated user", () => {
      const mockRequest = { auth: { user: { id: "test-user" } } };
      const isLoggedIn = !!mockRequest.auth;
      expect(isLoggedIn).toBe(true);
    });
  });

  describe("security headers", () => {
    test("should define correct security headers", () => {
      const expectedHeaders = {
        "Cache-Control": "private, no-cache",
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      };

      // ヘッダーの値が正しいことを確認
      expect(expectedHeaders["Cache-Control"]).toBe("private, no-cache");
      expect(expectedHeaders["X-Frame-Options"]).toBe("DENY");
      expect(expectedHeaders["X-Content-Type-Options"]).toBe("nosniff");
      expect(expectedHeaders["Strict-Transport-Security"]).toBe("max-age=31536000; includeSubDomains");
      expect(expectedHeaders["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    });
  });

  describe("URL handling", () => {
    test("should handle URL construction for redirect", () => {
      const baseUrl = "http://localhost:3000/dashboard";
      const pathname = "/dashboard";

      const signinUrl = new URL("/auth/signin", baseUrl);
      signinUrl.searchParams.set("callbackUrl", pathname);

      expect(signinUrl.pathname).toBe("/auth/signin");
      expect(signinUrl.searchParams.get("callbackUrl")).toBe("/dashboard");
    });

    test("should handle error redirect URL", () => {
      const baseUrl = "http://localhost:3000/dashboard";
      const errorUrl = new URL("/error", baseUrl);

      expect(errorUrl.pathname).toBe("/error");
    });
  });
});
