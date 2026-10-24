// @vitest-environment happy-dom
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../../test/render-with-providers";
import { HomePage } from "./home-page";

// 応答はテストごとに必要な項目だけを返すため、呼出しの型を緩める。
type AuthClientCall = (...args: unknown[]) => Promise<unknown>;

const authClientMock = vi.hoisted(() => ({
  signIn: { social: vi.fn<AuthClientCall>() },
  getLastUsedLoginMethod: vi.fn<() => string | null>(),
  useSession: vi.fn<() => { data: unknown; isPending: boolean }>(),
}));

vi.mock("../../../lib/auth-client", () => ({ authClient: authClientMock }));

const alice = { session: { id: "session-a", token: "token-a", userId: "ausr_alice" }, user: { id: "ausr_alice", name: "Alice" } };

beforeEach(() => {
  vi.resetAllMocks();
  authClientMock.getLastUsedLoginMethod.mockReturnValue(null);
  authClientMock.useSession.mockReturnValue({ data: null, isPending: false });
});

describe("HomePage", () => {
  it("サービス名と説明を見出しに置き、「アカウント連携へ」と「使い方」へのリンクを置く", async () => {
    renderWithProviders(<HomePage loginRequest={null} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Freeism Accounts" })).toBeDefined();
    expect(screen.getByText("アカウントが自分のものだと証明できるサービス")).toBeDefined();
    expect(screen.getByRole("link", { name: "アカウント連携へ" }).getAttribute("href")).toBe("/account-links");
    expect(screen.getByRole("link", { name: "使い方" }).getAttribute("href")).toBe("/help");
  });

  it("簡単な使い方として4つの手順を順に示す", async () => {
    renderWithProviders(<HomePage loginRequest={null} />);

    const steps = await screen.findByRole("region", { name: "簡単な使い方" });
    const items = within(steps).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("ログインする"),
      expect.stringContaining("アカウント所有の証明"),
      expect.stringContaining("公開先を選ぶ"),
      expect.stringContaining("連携先とつなぐ"),
    ]);
    expect(items[3]!.textContent).toContain("Freeism Points などから利用");
  });

  it("ログイン状態にかかわらず「ログインする」ボタンを置かない", async () => {
    authClientMock.useSession.mockReturnValue({ data: alice, isPending: false });
    renderWithProviders(<HomePage loginRequest={null} />);

    await screen.findByRole("heading", { level: 1, name: "Freeism Accounts" });
    expect(screen.queryByRole("button", { name: "ログインする" })).toBeNull();
  });

  it("利用側サービスから開いたログイン画面は、ログイン用のダイアログを自動で開き、失敗の案内を示す", async () => {
    renderWithProviders(<HomePage loginRequest={{ errorCode: "account_not_linked" }} />);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "GitHubでログイン" })).toBeDefined();
    expect(within(dialog).getByRole("alert").textContent).toContain("この外部アカウントはまだ連携されていません");
  });
});
