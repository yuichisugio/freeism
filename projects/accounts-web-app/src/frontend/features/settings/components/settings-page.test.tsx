// @vitest-environment happy-dom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dataResponse } from "../../../test/bff-responses";
import { renderWithProviders } from "../../../test/render-with-providers";
import { stubBff } from "../stub-bff.test-helper";
import { SettingsPage } from "./settings-page";

const sessionMock = vi.hoisted(() => ({
  useHydratedSession: vi.fn<() => { data: unknown; isPending: boolean }>(),
}));

vi.mock("../../../lib/use-hydrated-session", () => sessionMock);

const authClientMock = vi.hoisted(() => ({
  deleteUser: vi.fn<() => Promise<{ error: null }>>(),
}));

vi.mock("../../../lib/auth-client", () => ({
  authClient: {
    getLastUsedLoginMethod: () => null,
    deleteUser: authClientMock.deleteUser,
    $store: { notify: vi.fn<(signal: string) => void>() },
  },
}));

const me = { accountsUserId: "ausr_alice", displayName: "Alice", profileUrl: "https://accounts.example/profiles/ausr_alice" };

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * 画面の設問カードの見出しを上から順に返す。
 */
function cardTitles(): string[] {
  return screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent ?? "");
}

describe("SettingsPage: 未ログイン", () => {
  beforeEach(() => {
    sessionMock.useHydratedSession.mockReturnValue({ data: null, isPending: false });
  });

  it("言語とテーマだけを表示し、ほかの設定はログインを求める1文にする", async () => {
    const fetchMock = stubBff({});
    renderWithProviders(<SettingsPage />, { path: "/settings" });

    expect(await screen.findByRole("heading", { level: 1, name: "その他" })).toBeDefined();
    expect(screen.getByText("ほかの設定を表示するにはログインしてください")).toBeDefined();
    expect(cardTitles()).toEqual(["言語", "テーマ"]);
    // ログインのダイアログは自動で開かない。
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("「ログインする」でログイン用のダイアログを開く", async () => {
    stubBff({});
    renderWithProviders(<SettingsPage />, { path: "/settings" });

    await userEvent.click(await screen.findByRole("button", { name: "ログインする" }));

    expect(within(await screen.findByRole("dialog")).getByText("Freeism Accounts にログイン")).toBeDefined();
  });
});

describe("SettingsPage: ログイン中", () => {
  beforeEach(() => {
    sessionMock.useHydratedSession.mockReturnValue({ data: { user: { id: "ausr_alice" } }, isPending: false });
    stubBff({
      "GET /api/me": () => dataResponse(me),
      "GET /api/oauth-clients": () => dataResponse({ clients: [] }),
    });
  });

  it("設問カードを表示名・言語・テーマ・データ出力・データ取込・開発者向け・退会の順に並べる", async () => {
    renderWithProviders(<SettingsPage />, { path: "/ausr_alice/settings" });

    await screen.findByRole("textbox", { name: "表示名" });
    expect(cardTitles()).toEqual(["表示名", "言語", "テーマ", "データ出力", "データ取込", "開発者向け", "退会"]);
    expect(screen.queryByText("ほかの設定を表示するにはログインしてください")).toBeNull();
  });

  it("表示名を変更したときだけ保存バーを表示し、「破棄」で元に戻す", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { path: "/ausr_alice/settings" });

    const input = await screen.findByRole<HTMLInputElement>("textbox", { name: "表示名" });
    expect(screen.queryByText("未保存 1件")).toBeNull();
    await user.type(input, "!");

    expect(await screen.findByText("未保存 1件")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "破棄" }));

    expect(input.value).toBe("Alice");
    expect(screen.queryByText("未保存 1件")).toBeNull();
  });

  it("表示名を変更したまま「使い方」へ移動しようとすると、未保存の確認を出して留まる", async () => {
    const user = userEvent.setup();
    const { router } = renderWithProviders(<SettingsPage />, { path: "/ausr_alice/settings" });

    await user.type(await screen.findByRole("textbox", { name: "表示名" }), "!");
    await user.click(screen.getByRole("link", { name: "使い方" }));

    expect(within(await screen.findByRole("alertdialog")).getByText("保存していない変更があります")).toBeDefined();
    expect(router.state.location.pathname).toBe("/ausr_alice/settings");
  });

  it("退会に成功すると、表示名の未保存の変更があっても確認せずにトップページへ移動する", async () => {
    authClientMock.deleteUser.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    const { router } = renderWithProviders(<SettingsPage />, { path: "/ausr_alice/settings" });

    await user.type(await screen.findByRole("textbox", { name: "表示名" }), "!");
    await user.click(screen.getByRole("button", { name: "退会" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByRole("textbox"), "DELETE");
    await user.click(within(dialog).getByRole("button", { name: "退会する" }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(screen.queryByText("保存していない変更があります")).toBeNull();
  });
});
