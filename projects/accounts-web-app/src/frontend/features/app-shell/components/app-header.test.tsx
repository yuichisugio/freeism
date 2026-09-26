// @vitest-environment happy-dom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../../test/render-with-providers";
import { AppFooter, AppHeader } from "./app-header";

// 応答はテストごとに必要な項目だけを返すため、呼出しの型を緩める。
type AuthClientCall = (...args: unknown[]) => Promise<unknown>;

const authClientMock = vi.hoisted(() => ({
  useSession: vi.fn<() => { data: unknown; isPending: boolean }>(),
  signIn: { social: vi.fn<AuthClientCall>() },
  getLastUsedLoginMethod: vi.fn<() => string | null>(),
  multiSession: {
    listDeviceSessions: vi.fn<AuthClientCall>(),
    setActive: vi.fn<AuthClientCall>(),
    revoke: vi.fn<AuthClientCall>(),
  },
  $store: { notify: vi.fn<(signal: string) => void>() },
}));

vi.mock("../../../lib/auth-client", () => ({ authClient: authClientMock }));

const alice = { session: { id: "session-a", token: "token-a", userId: "ausr_alice" }, user: { id: "ausr_alice", name: "alice" } };
const bob = { session: { id: "session-b", token: "token-b", userId: "ausr_bob" }, user: { id: "ausr_bob", name: "Bob" } };

beforeEach(() => {
  vi.resetAllMocks();
  authClientMock.useSession.mockReturnValue({ data: null, isPending: false });
  authClientMock.getLastUsedLoginMethod.mockReturnValue(null);
  authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: [], error: null });
});

/**
 * aliceでログインした状態でヘッダーを描画し、アカウントのメニューを開く。
 */
async function openAccountMenu(path = "/") {
  authClientMock.useSession.mockReturnValue({ data: alice, isPending: false });
  authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: [alice, bob], error: null });
  const rendered = renderWithProviders(<AppHeader />, { path });
  await userEvent.click(await screen.findByRole("button", { name: "アカウントのメニュー（alice）" }));
  const menu = await screen.findByRole("menu");
  await within(menu).findByRole("menuitem", { name: /Bob/ });
  return { ...rendered, menu };
}

describe("AppHeader", () => {
  it("左上のサービス名の左にロゴを置き、トップページへのリンクにする", async () => {
    renderWithProviders(<AppHeader />);

    const homeLink = await screen.findByRole("link", { name: "Accounts" });
    expect(homeLink.getAttribute("href")).toBe("/");
    expect(homeLink.querySelector("img")?.getAttribute("src")).toBe("/favicon.svg");
  });

  it("プライバシーポリシー・利用規約と表示言語の切替はヘッダーに置かない", async () => {
    renderWithProviders(<AppHeader />);

    await screen.findByRole("link", { name: "Accounts" });
    expect(screen.queryByRole("link", { name: "プライバシーポリシー" })).toBeNull();
    expect(screen.queryByRole("link", { name: "利用規約" })).toBeNull();
    expect(screen.queryByRole("button", { name: "English" })).toBeNull();
  });

  it("ログインしていない場合は、画面へのリンクをユーザーIDの無い経路にし、「ログインする」からログイン用のダイアログを開く", async () => {
    renderWithProviders(<AppHeader />);

    expect((await screen.findByRole("link", { name: "アカウント連携" })).getAttribute("href")).toBe("/account-links");
    await userEvent.click(screen.getByRole("button", { name: "ログインする" }));

    expect(within(await screen.findByRole("dialog")).getByRole("button", { name: "Googleでログイン" })).toBeDefined();
  });

  it("ログイン済みの場合は、画面へのリンクに現在のユーザーのIDを付け、「ログインする」の代わりにアイコンを置く", async () => {
    authClientMock.useSession.mockReturnValue({ data: alice, isPending: false });
    renderWithProviders(<AppHeader />);

    const trigger = await screen.findByRole("button", { name: "アカウントのメニュー（alice）" });
    expect(trigger.textContent).toBe("A");
    expect(screen.getByRole("link", { name: "アカウント連携" }).getAttribute("href")).toBe("/ausr_alice/account-links");
    expect(screen.getByRole("link", { name: "設定" }).getAttribute("href")).toBe("/ausr_alice/settings");
    expect(screen.queryByRole("button", { name: "ログインする" })).toBeNull();
  });

  it("メニューに、このブラウザーでログイン中のユーザーを現在のユーザーを示して並べ、その下にアカウントの追加とログアウトを置く", async () => {
    const { menu } = await openAccountMenu();

    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("alice"),
      expect.stringContaining("Bob"),
      "アカウントを追加",
      "ログアウト",
    ]);
    expect(items[0]?.textContent).toContain("現在のユーザー");
    expect(items[1]?.textContent).toContain("ausr_bob");
    expect(items[1]?.textContent).not.toContain("現在のユーザー");
  });

  it("トップページで別のユーザーを押すと、そのユーザーのセッションへ切り替える", async () => {
    authClientMock.multiSession.setActive.mockResolvedValue({ data: bob, error: null });
    const { menu } = await openAccountMenu();

    await userEvent.click(within(menu).getByRole("menuitem", { name: /Bob/ }));

    expect(authClientMock.multiSession.setActive).toHaveBeenCalledWith({ sessionToken: "token-b" });
  });

  it("ユーザーID付きの画面で別のユーザーを押すと、同じ画面のそのユーザーのURLへ移動する", async () => {
    const { menu, router } = await openAccountMenu("/ausr_alice/settings");

    await userEvent.click(within(menu).getByRole("menuitem", { name: /Bob/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/ausr_bob/settings"));
    // セッションの切替は、移動先の画面がURLのユーザーに合わせて行う。
    expect(authClientMock.multiSession.setActive).not.toHaveBeenCalled();
  });

  it("切替に失敗した場合は、失敗を示す", async () => {
    authClientMock.multiSession.setActive.mockResolvedValue({ data: null, error: { status: 401 } });
    const { menu } = await openAccountMenu();

    await userEvent.click(within(menu).getByRole("menuitem", { name: /Bob/ }));

    expect((await screen.findByRole("alert")).textContent).toContain("切り替えられませんでした");
  });

  it("「アカウントを追加」は、別のユーザーとしてログインするダイアログを開く", async () => {
    const { menu } = await openAccountMenu();

    await userEvent.click(within(menu).getByRole("menuitem", { name: "アカウントを追加" }));

    expect(within(await screen.findByRole("dialog")).getByRole("button", { name: "GitHubでログイン" })).toBeDefined();
  });

  it("「ログアウト」は、トップページへ移動してから現在のユーザーのセッションだけを終了し、セッションを読み直す", async () => {
    authClientMock.multiSession.revoke.mockResolvedValue({ data: { status: true }, error: null });
    const { menu, router } = await openAccountMenu("/ausr_alice/settings");

    await userEvent.click(within(menu).getByRole("menuitem", { name: "ログアウト" }));

    await waitFor(() => expect(authClientMock.multiSession.revoke).toHaveBeenCalledWith({ sessionToken: "token-a" }));
    expect(router.state.location.pathname).toBe("/");
    expect(authClientMock.$store.notify).toHaveBeenCalledWith("$sessionSignal");
  });

  it("ログアウトに失敗した場合は、失敗を示す", async () => {
    authClientMock.multiSession.revoke.mockResolvedValue({ data: null, error: { status: 500 } });
    const { menu } = await openAccountMenu();

    await userEvent.click(within(menu).getByRole("menuitem", { name: "ログアウト" }));

    expect((await screen.findByRole("alert")).textContent).toContain("ログアウトできませんでした");
    expect(authClientMock.$store.notify).not.toHaveBeenCalled();
  });
});

describe("AppFooter", () => {
  it("OSSライセンスの右に、プライバシーポリシーと利用規約へのリンクを置く", async () => {
    renderWithProviders(<AppFooter />, { language: "en" });

    const footer = await screen.findByRole("contentinfo");
    const links = within(footer).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Help",
      "Open source licenses",
      "Privacy policy",
      "Terms of use",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/help", "/licenses", "/privacy", "/terms"]);
  });

  it("ユーザーID付きの画面では、リンクに同じユーザーのIDを付ける", async () => {
    renderWithProviders(<AppFooter />, { path: "/ausr_alice/settings" });

    expect((await screen.findByRole("link", { name: "ヘルプ" })).getAttribute("href")).toBe("/ausr_alice/help");
  });
});
