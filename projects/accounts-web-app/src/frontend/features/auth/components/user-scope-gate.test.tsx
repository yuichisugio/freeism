// @vitest-environment happy-dom
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { act, useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../../lib/i18n/i18n-provider";
import { LoginDialogProvider } from "./login-dialog";
import { UserScopeGate } from "./user-scope-gate";

// 応答はテストごとに必要な項目だけを返すため、呼出しの型を緩める。
type AuthClientCall = (...args: unknown[]) => Promise<unknown>;

const authClientMock = vi.hoisted(() => ({
  useSession: vi.fn<() => { data: unknown; isPending: boolean }>(),
  signIn: { social: vi.fn<AuthClientCall>() },
  getLastUsedLoginMethod: vi.fn<() => string | null>(),
  multiSession: { listDeviceSessions: vi.fn<AuthClientCall>(), setActive: vi.fn<AuthClientCall>() },
}));

vi.mock("../../../lib/auth-client", () => ({ authClient: authClientMock }));

const alice = { session: { id: "session-a", token: "token-a", userId: "ausr_alice" }, user: { id: "ausr_alice", name: "Alice" } };
const bob = { session: { id: "session-b", token: "token-b", userId: "ausr_bob" }, user: { id: "ausr_bob", name: "Bob" } };

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.resetAllMocks();
  authClientMock.getLastUsedLoginMethod.mockReturnValue(null);
  authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: [alice], error: null });
});

/**
 * 画面の経路（`/{-$accountsUserId}/settings`・`/{-$accountsUserId}/help`）と同じ構成のルーターで、指定したURLを開く。
 * ヘルプは実際の経路と同じく、ユーザーの情報を扱わない画面として指定する。
 */
function renderUserScopedPage(path: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <I18nProvider initialLanguage="ja">
        <LoginDialogProvider>
          <Outlet />
        </LoginDialogProvider>
      </I18nProvider>
    ),
  });
  const userScopeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "{-$accountsUserId}",
    component: () => (
      <UserScopeGate>
        <Outlet />
      </UserScopeGate>
    ),
  });
  const settingsRoute = createRoute({
    getParentRoute: () => userScopeRoute,
    path: "settings",
    component: () => <p>settings page</p>,
  });
  const helpRoute = createRoute({
    getParentRoute: () => userScopeRoute,
    path: "help",
    staticData: { isUserIndependent: true },
    component: () => <p>help page</p>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([userScopeRoute.addChildren([settingsRoute, helpRoute])]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe("UserScopeGate", () => {
  it("ログインしていない場合は、ユーザーIDの無いURLのまま画面を表示する", async () => {
    authClientMock.useSession.mockReturnValue({ data: null, isPending: false });
    const router = renderUserScopedPage("/settings");

    expect(await screen.findByText("settings page")).toBeDefined();
    expect(router.state.location.pathname).toBe("/settings");
  });

  it("ログイン済みでユーザーIDの無いURLを開くと、クエリとハッシュを保って現在のユーザーのID付きのURLへ置き換える", async () => {
    authClientMock.useSession.mockReturnValue({ data: alice, isPending: false });
    const router = renderUserScopedPage("/settings?sig=abc&exp=1#top");

    expect(await screen.findByText("settings page")).toBeDefined();
    expect(router.state.location.pathname).toBe("/ausr_alice/settings");
    expect(router.state.location.searchStr).toBe("?sig=abc&exp=1");
    expect(router.state.location.hash).toBe("top");
  });

  it("URLのユーザーが現在のユーザーなら、そのまま画面を表示する", async () => {
    authClientMock.useSession.mockReturnValue({ data: alice, isPending: false });
    renderUserScopedPage("/ausr_alice/settings");

    expect(await screen.findByText("settings page")).toBeDefined();
    expect(authClientMock.multiSession.setActive).not.toHaveBeenCalled();
  });

  it("URLのユーザーがこのブラウザーでログイン中のほかのユーザーなら、そのユーザーへ切り替えるまで画面を表示しない", async () => {
    authClientMock.useSession.mockReturnValue({ data: alice, isPending: false });
    authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: [alice, bob], error: null });
    authClientMock.multiSession.setActive.mockResolvedValue({ data: bob, error: null });
    renderUserScopedPage("/ausr_bob/settings");

    await waitFor(() => expect(authClientMock.multiSession.setActive).toHaveBeenCalledWith({ sessionToken: "token-b" }));
    expect(screen.queryByText("settings page")).toBeNull();
  });

  it("切り替えて現在のセッションがURLのユーザーになると、画面を表示する", async () => {
    // `setActive`の後にBetter Authのクライアントが現在のセッションを読み直す動きを、外部のストアで再現する。
    let currentSession: unknown = { data: alice, isPending: false };
    const listeners = new Set<() => void>();
    authClientMock.useSession.mockImplementation(() =>
      useSyncExternalStore(
        (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        () => currentSession as { data: unknown; isPending: boolean },
      ),
    );
    authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: [alice, bob], error: null });
    authClientMock.multiSession.setActive.mockResolvedValue({ data: bob, error: null });
    renderUserScopedPage("/ausr_bob/settings");
    await waitFor(() => expect(authClientMock.multiSession.setActive).toHaveBeenCalled());

    act(() => {
      currentSession = { data: bob, isPending: false };
      for (const listener of listeners) listener();
    });

    expect(await screen.findByText("settings page")).toBeDefined();
  });

  it("URLのユーザーでログインしていない場合は、ログイン用のダイアログを開き、ログイン後に同じURLへ戻す", async () => {
    authClientMock.useSession.mockReturnValue({ data: alice, isPending: false });
    authClientMock.signIn.social.mockResolvedValue({ data: { redirect: true, url: "https://example.com" }, error: null });
    renderUserScopedPage("/ausr_bob/settings");

    const dialog = await screen.findByRole("dialog");
    expect(screen.queryByText("settings page")).toBeNull();
    expect(screen.getByText(/ausr_bob/)).toBeDefined();
    within(dialog).getByRole("button", { name: "Googleでログイン" }).click();

    await waitFor(() =>
      expect(authClientMock.signIn.social).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: "/ausr_bob/settings",
        errorCallbackURL: "/ausr_bob/settings",
      }),
    );
  });

  it("URLのユーザーでのログインに失敗して戻された場合は、失敗の案内とともにダイアログを開く", async () => {
    authClientMock.useSession.mockReturnValue({ data: null, isPending: false });
    renderUserScopedPage("/ausr_bob/settings?error=account_not_linked");

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("alert").textContent).toContain("この外部アカウントはまだ連携されていません");
  });

  it("切替に失敗した場合は、失敗を示して画面を表示しない", async () => {
    authClientMock.useSession.mockReturnValue({ data: alice, isPending: false });
    authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: [alice, bob], error: null });
    authClientMock.multiSession.setActive.mockResolvedValue({ data: null, error: { status: 401 } });
    renderUserScopedPage("/ausr_bob/settings");

    expect((await screen.findByRole("alert")).textContent).toContain("切り替えられませんでした");
    expect(screen.queryByText("settings page")).toBeNull();
  });

  it("セッションの確認中は画面を表示しない", async () => {
    authClientMock.useSession.mockReturnValue({ data: null, isPending: true });
    renderUserScopedPage("/settings");

    expect(await screen.findByRole("status")).toBeDefined();
    expect(screen.queryByText("settings page")).toBeNull();
  });

  describe("ユーザーの情報を扱わない画面（ヘルプなど）", () => {
    it("未ログインでほかのユーザーのURLを開くと、ログインを求めずユーザーIDの無いURLへ置き換えて表示する", async () => {
      authClientMock.useSession.mockReturnValue({ data: null, isPending: false });
      authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: [], error: null });
      const router = renderUserScopedPage("/ausr_bob/help?lang=ja#faq");

      expect(await screen.findByText("help page")).toBeDefined();
      expect(router.state.location.pathname).toBe("/help");
      expect(router.state.location.searchStr).toBe("?lang=ja");
      expect(router.state.location.hash).toBe("faq");
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("URLのユーザーでログインしていない場合は、現在のユーザーのID付きのURLへ置き換えて表示する", async () => {
      authClientMock.useSession.mockReturnValue({ data: alice, isPending: false });
      const router = renderUserScopedPage("/ausr_bob/help");

      expect(await screen.findByText("help page")).toBeDefined();
      expect(router.state.location.pathname).toBe("/ausr_alice/help");
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
