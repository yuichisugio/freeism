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
});
