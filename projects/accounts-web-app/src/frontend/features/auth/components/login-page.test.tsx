// @vitest-environment happy-dom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../../test/render-with-providers";
import { LoginPage } from "./login-page";

// 応答はテストごとに必要な項目だけを返すため、呼出しの型を緩める。
type AuthClientCall = (...args: unknown[]) => Promise<unknown>;

const authClientMock = vi.hoisted(() => ({
  signIn: { social: vi.fn<AuthClientCall>() },
  getLastUsedLoginMethod: vi.fn<() => string | null>(),
  getSession: vi.fn<AuthClientCall>(),
  multiSession: { listDeviceSessions: vi.fn<AuthClientCall>(), setActive: vi.fn<AuthClientCall>() },
}));

vi.mock("../../../lib/auth-client", () => ({ authClient: authClientMock }));

const alice = { session: { id: "session-a", token: "token-a", userId: "ausr_alice" }, user: { id: "ausr_alice", name: "Alice" } };
const bob = { session: { id: "session-b", token: "token-b", userId: "ausr_bob" }, user: { id: "ausr_bob", name: "Bob" } };

beforeEach(() => {
  vi.resetAllMocks();
  authClientMock.getLastUsedLoginMethod.mockReturnValue(null);
  authClientMock.getSession.mockResolvedValue({ data: null, error: null });
  authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: [], error: null });
});

describe("LoginPage", () => {
  it("Google・GitHub・ORCIDのログインボタンを表示し、押したProviderでログインを開始する", async () => {
    authClientMock.signIn.social.mockResolvedValue({ data: { redirect: true, url: "https://example.com" }, error: null });
    renderWithProviders(<LoginPage errorCode={undefined} />);

    await userEvent.click(await screen.findByRole("button", { name: "ORCIDでログイン" }));

    expect(screen.getByRole("button", { name: "Googleでログイン" })).toBeDefined();
    expect(screen.getByRole("button", { name: "GitHubでログイン" })).toBeDefined();
    expect(authClientMock.signIn.social).toHaveBeenCalledWith(expect.objectContaining({ provider: "orcid" }));
  });

  it("account_not_linkedは、既存のログイン手段からの明示連携をalertで案内する", async () => {
    renderWithProviders(<LoginPage errorCode="account_not_linked" />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("既存のログイン手段でログインし、「アカウント連携」画面から");
    expect(alert.textContent).toContain("元のAccountsユーザーを退会");
  });

  it("email_not_foundは、GitHubのメールアドレスを取得できない場合の対処をalertで案内する", async () => {
    renderWithProviders(<LoginPage errorCode="email_not_found" />, { language: "en" });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Could not get an email address from GitHub");
  });

  it("その他のエラーは、汎用の失敗としてエラーコードを添えて案内する", async () => {
    renderWithProviders(<LoginPage errorCode="state_mismatch" />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("ログインできませんでした");
    expect(alert.textContent).toContain("state_mismatch");
  });

  it("エラーが無い場合は失敗の案内を表示しない", async () => {
    renderWithProviders(<LoginPage errorCode={undefined} />);

    await screen.findByRole("button", { name: "Googleでログイン" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("前回のログイン方法のボタンに「前回使用」のテキストを添える", async () => {
    authClientMock.getLastUsedLoginMethod.mockReturnValue("github");
    renderWithProviders(<LoginPage errorCode={undefined} />);

    const githubItem = (await screen.findByRole("button", { name: "GitHubでログイン" })).closest("li");
    expect(githubItem?.textContent).toContain("前回使用");
    expect(screen.getAllByText("前回使用")).toHaveLength(1);
  });

  it("ログイン済みのセッションがあれば、表示名・IDと現在のセッションを示し、別のユーザーへ切り替えられる", async () => {
    authClientMock.getSession.mockResolvedValue({ data: alice, error: null });
    authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: [alice, bob], error: null });
    authClientMock.multiSession.setActive.mockResolvedValue({ data: bob, error: null });
    renderWithProviders(<LoginPage errorCode={undefined} />);

    const aliceItem = (await screen.findByText("Alice")).closest("li");
    expect(aliceItem?.textContent).toContain("ausr_alice");
    expect(within(aliceItem as HTMLElement).getByText("現在のセッション")).toBeDefined();
    expect(screen.getByRole("link", { name: "アカウント連携へ" })).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: "Bobに切り替える" }));

    expect(authClientMock.multiSession.setActive).toHaveBeenCalledWith({ sessionToken: "token-b" });
    expect((await screen.findByRole("status")).textContent).toContain("切り替えました。");
    const bobItem = screen.getByText("Bob").closest("li");
    expect(within(bobItem as HTMLElement).getByText("現在のセッション")).toBeDefined();
  });

  it("ログインしていない場合はセッション一覧を表示しない", async () => {
    renderWithProviders(<LoginPage errorCode={undefined} />);

    await screen.findByRole("button", { name: "Googleでログイン" });
    await vi.waitFor(() => expect(authClientMock.multiSession.listDeviceSessions).toHaveBeenCalled());
    expect(screen.queryByText("このブラウザーでログイン中のAccountsユーザー")).toBeNull();
  });
});
