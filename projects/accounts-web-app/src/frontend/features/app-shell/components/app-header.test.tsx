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
  it("左上にロゴとサービス名を置き、トップページへのリンクにする", async () => {
    renderWithProviders(<AppHeader />);

    const homeLink = await screen.findByRole("link", { name: "Freeism Accounts" });
    expect(homeLink.getAttribute("href")).toBe("/");
    expect(homeLink.querySelector("svg")).not.toBeNull();
  });

  it("メインメニューに「トップ」「アカウント連携」「その他」のタブだけを置く", async () => {
    renderWithProviders(<AppHeader />);

    const navigation = await screen.findByRole("navigation", { name: "メインメニュー" });
    const tabs = within(navigation).getAllByRole("link");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["トップ", "アカウント連携", "その他"]);
    expect(screen.queryByRole("link", { name: "開発者向け" })).toBeNull();
    expect(screen.queryByRole("link", { name: "プライバシーポリシー" })).toBeNull();
  });

  it("ログインしていない場合は、タブをユーザーIDの無い経路にし、右端に何も置かない", async () => {
    renderWithProviders(<AppHeader />);

    const navigation = await screen.findByRole("navigation", { name: "メインメニュー" });
    expect(within(navigation).getAllByRole("link").map((tab) => tab.getAttribute("href"))).toEqual([
      "/",
      "/account-links",
      "/settings",
    ]);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("ログイン済みの場合は、タブに現在のユーザーのIDを付け、右端に人のアイコンのメニューを置く", async () => {
    authClientMock.useSession.mockReturnValue({ data: alice, isPending: false });
    renderWithProviders(<AppHeader />);

    const trigger = await screen.findByRole("button", { name: "アカウントのメニュー（alice）" });
    expect(trigger.textContent).toBe("");
    expect(trigger.querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("link", { name: "アカウント連携" }).getAttribute("href")).toBe("/ausr_alice/account-links");
    expect(screen.getByRole("link", { name: "その他" }).getAttribute("href")).toBe("/ausr_alice/settings");
    expect(screen.queryByRole("button", { name: "ログインする" })).toBeNull();
  });

  it("開いている画面のタブを現在のページとして示す", async () => {
    authClientMock.useSession.mockReturnValue({ data: alice, isPending: false });
    renderWithProviders(<AppHeader />, { path: "/ausr_alice/settings" });

    expect((await screen.findByRole("link", { name: "その他" })).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "トップ" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: "アカウント連携" }).getAttribute("aria-current")).toBeNull();
  });

  it("メニューは見出しを置かず、現在のユーザー・ほかのユーザー・アカウントの追加・現在のユーザーのログアウトの順に並べる", async () => {
    const { menu } = await openAccountMenu();

    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("alice"),
      expect.stringContaining("Bob"),
      "アカウントを追加",
      "aliceからログアウト",
    ]);
    expect(items[0]?.textContent).toContain("現在のユーザー");
    expect(items[1]?.textContent).toContain("ausr_bob");
    expect(items[1]?.textContent).not.toContain("現在のユーザー");
    expect(within(menu).queryByText("このブラウザーでログイン中のユーザー")).toBeNull();
  });

  it("現在のユーザーは、ほかのユーザーの並びにかかわらず先頭に置く", async () => {
    authClientMock.useSession.mockReturnValue({ data: alice, isPending: false });
    authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: [bob, alice], error: null });
    renderWithProviders(<AppHeader />);
    await userEvent.click(await screen.findByRole("button", { name: "アカウントのメニュー（alice）" }));
    const menu = await screen.findByRole("menu");
    await within(menu).findByRole("menuitem", { name: /Bob/ });

    const items = within(menu).getAllByRole("menuitem");
    expect(items[0]?.textContent).toContain("現在のユーザー");
    expect(items[0]?.textContent).toContain("alice");
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

  it("ログアウトは、トップページへ移動してから現在のユーザーのセッションだけを終了し、セッションを読み直す", async () => {
    authClientMock.multiSession.revoke.mockResolvedValue({ data: { status: true }, error: null });
    const { menu, router } = await openAccountMenu("/ausr_alice/settings");

    await userEvent.click(within(menu).getByRole("menuitem", { name: "aliceからログアウト" }));

    await waitFor(() => expect(authClientMock.multiSession.revoke).toHaveBeenCalledWith({ sessionToken: "token-a" }));
    expect(router.state.location.pathname).toBe("/");
    expect(authClientMock.$store.notify).toHaveBeenCalledWith("$sessionSignal");
  });

  it("ログアウトに失敗した場合は、失敗を示す", async () => {
    authClientMock.multiSession.revoke.mockResolvedValue({ data: null, error: { status: 500 } });
    const { menu } = await openAccountMenu();

    await userEvent.click(within(menu).getByRole("menuitem", { name: "aliceからログアウト" }));

    expect((await screen.findByRole("alert")).textContent).toContain("ログアウトできませんでした");
    expect(authClientMock.$store.notify).not.toHaveBeenCalled();
  });
});

describe("AppFooter", () => {
  it("使い方・OSSライセンス・プライバシーポリシー・利用規約へのリンクを置く", async () => {
    renderWithProviders(<AppFooter />);

    const footer = await screen.findByRole("contentinfo");
    const links = within(footer).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["使い方", "OSSライセンス", "プライバシーポリシー", "利用規約"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/help", "/licenses", "/privacy", "/terms"]);
  });

  it("英語の画面では英語の名前で示す", async () => {
    renderWithProviders(<AppFooter />, { language: "en" });

    const footer = await screen.findByRole("contentinfo");
    expect(within(footer).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Guide",
      "Open source licenses",
      "Privacy policy",
      "Terms of use",
    ]);
  });

  it("ユーザーID付きの画面では、リンクに同じユーザーのIDを付ける", async () => {
    renderWithProviders(<AppFooter />, { path: "/ausr_alice/settings" });

    expect((await screen.findByRole("link", { name: "使い方" })).getAttribute("href")).toBe("/ausr_alice/help");
  });
});
