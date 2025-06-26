import type React from "react";
import { vi } from "vitest";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Auth.js関連のモック設定
 * テストファイルで個別にモックする必要がなくなります
 */

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * next-auth/react のモック設定
 * useSessionをモック化
 */
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: {
      user: {
        id: "cmb0e9xnm0001mchbj6ler4py",
        email: "test@example.com",
        name: "Test User",
        image: "https://example.com/avatar.jpg",
      },
      accessToken: "test-access-token",
    },
    status: "authenticated",
  })),
  signIn: vi.fn(() => Promise.resolve({ ok: true })),
  signOut: vi.fn(() => Promise.resolve({ ok: true })),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * next-auth のモック設定
 * auth関数をモック化
 */
vi.mock("next-auth", () => ({
  default: vi.fn(() => Promise.resolve()),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * @/library-setting/auth のモック設定
 * auth関数をモック化
 */
vi.mock("@/library-setting/auth", () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: {
        id: "cmb0e9xnm0001mchbj6ler4py",
        email: "test@example.com",
        name: "Test User",
        image: "https://example.com/avatar.jpg",
      },
    }),
  ),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
