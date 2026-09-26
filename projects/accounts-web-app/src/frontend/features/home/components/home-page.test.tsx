// @vitest-environment happy-dom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../../test/render-with-providers";
import { HomePage } from "./home-page";

// 応答はテストごとに必要な項目だけを返すため、呼出しの型を緩める。
type AuthClientCall = (...args: unknown[]) => Promise<unknown>;

const authClientMock = vi.hoisted(() => ({
  signIn: { social: vi.fn<AuthClientCall>() },
  getLastUsedLoginMethod: vi.fn<() => string | null>(),
  useSession: vi.fn<() => { data: unknown; isPending: boolean }>(),
  multiSession: { listDeviceSessions: vi.fn<AuthClientCall>(), setActive: vi.fn<AuthClientCall>() },
}));

vi.mock("../../../lib/auth-client", () => ({ authClient: authClientMock }));

const alice = { session: { id: "session-a", token: "token-a", userId: "ausr_alice" }, user: { id: "ausr_alice", name: "Alice" } };
const bob = { session: { id: "session-b", token: "token-b", userId: "ausr_bob" }, user: { id: "ausr_bob", name: "Bob" } };

beforeEach(() => {
  vi.resetAllMocks();
  authClientMock.getLastUsedLoginMethod.mockReturnValue(null);
  authClientMock.useSession.mockReturnValue({ data: null, isPending: false });
  authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: [], error: null });
});

describe("HomePage", () => {
  it("簡単な使い方を紹介し、ヘルプへのリンクを置く", async () => {
    renderWithProviders(<HomePage loginRequest={null} />);

    expect(await screen.findByRole("heading", { level: 2, name: "簡単な使い方" })).toBeDefined();
    expect(screen.getByRole("link", { name: "詳しい使い方はヘルプへ" }).getAttribute("href")).toBe("/help");
  });

  it("ログインしていない場合は「ログインする」からログイン用のダイアログを開ける", async () => {
    renderWithProviders(<HomePage loginRequest={null} />);

    expect(screen.queryByRole("button", { name: "Googleでログイン" })).toBeNull();
    await userEvent.click(await screen.findByRole("button", { name: "ログインする" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Googleでログイン" })).toBeDefined();
  });

  it("利用側サービスから開いたログイン画面は、ログイン用のダイアログを自動で開き、失敗の案内を示す", async () => {
    renderWithProviders(<HomePage loginRequest={{ errorCode: "account_not_linked" }} />);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "GitHubでログイン" })).toBeDefined();
    expect(within(dialog).getByRole("alert").textContent).toContain("この外部アカウントはまだ連携されていません");
  });

  it("ログイン済みの場合は、ログインの操作を表示せず、ログイン中のユーザーと切替を示す", async () => {
    authClientMock.useSession.mockReturnValue({ data: alice, isPending: false });
    authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: [alice, bob], error: null });
    authClientMock.multiSession.setActive.mockResolvedValue({ data: bob, error: null });
    renderWithProviders(<HomePage loginRequest={null} />);

    const aliceItem = (await screen.findByText("Alice")).closest("li");
    expect(aliceItem?.textContent).toContain("ausr_alice");
    expect(within(aliceItem as HTMLElement).getByText("現在のセッション")).toBeDefined();
    expect(screen.getByRole("link", { name: "アカウント連携へ" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "ログインする" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Googleでログイン" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Bobに切り替える" }));

    expect(authClientMock.multiSession.setActive).toHaveBeenCalledWith({ sessionToken: "token-b" });
    expect((await screen.findByRole("status")).textContent).toContain("切り替えました。");
  });

  it("ログイン済みでも、別のAccountsユーザーを追加するためにログイン用のダイアログを開ける", async () => {
    authClientMock.useSession.mockReturnValue({ data: alice, isPending: false });
    authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: [alice], error: null });
    renderWithProviders(<HomePage loginRequest={null} />);

    await userEvent.click(await screen.findByRole("button", { name: "別のAccountsユーザーでログイン" }));

    expect(within(await screen.findByRole("dialog")).getByRole("button", { name: "ORCIDでログイン" })).toBeDefined();
  });

  it("セッションの確認中は、ログインの操作もセッション一覧も表示しない", async () => {
    authClientMock.useSession.mockReturnValue({ data: null, isPending: true });
    renderWithProviders(<HomePage loginRequest={null} />);

    await screen.findByRole("heading", { level: 2, name: "簡単な使い方" });
    expect(screen.queryByRole("button", { name: "ログインする" })).toBeNull();
    expect(screen.queryByText("このブラウザーでログイン中のAccountsユーザー")).toBeNull();
  });
});
