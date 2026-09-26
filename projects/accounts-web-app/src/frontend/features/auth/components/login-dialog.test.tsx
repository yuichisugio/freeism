// @vitest-environment happy-dom
import { Button } from "@heroui/react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../../test/render-with-providers";
import { useLoginDialog } from "../hooks/use-login-dialog";

// 応答はテストごとに必要な項目だけを返すため、呼出しの型を緩める。
type AuthClientCall = (...args: unknown[]) => Promise<unknown>;

const authClientMock = vi.hoisted(() => ({
  signIn: { social: vi.fn<AuthClientCall>() },
  getLastUsedLoginMethod: vi.fn<() => string | null>(),
}));

vi.mock("../../../lib/auth-client", () => ({ authClient: authClientMock }));

beforeEach(() => {
  vi.resetAllMocks();
  authClientMock.getLastUsedLoginMethod.mockReturnValue(null);
});

/**
 * ログインダイアログを開くボタン。
 */
function OpenLoginDialogButton({ errorCode }: { errorCode?: string }) {
  const loginDialog = useLoginDialog();
  return <Button onPress={() => loginDialog.open(errorCode)}>open</Button>;
}

/**
 * ダイアログを開いて、ダイアログの要素を返す。
 */
async function openLoginDialog(errorCode?: string, language?: "ja" | "en") {
  renderWithProviders(<OpenLoginDialogButton errorCode={errorCode} />, { language });
  await userEvent.click(await screen.findByRole("button", { name: "open" }));
  return screen.findByRole("dialog");
}

describe("LoginDialog", () => {
  it("Google・GitHub・ORCIDのログインボタンを表示し、押したProviderでログインを開始する", async () => {
    authClientMock.signIn.social.mockResolvedValue({ data: { redirect: true, url: "https://example.com" }, error: null });
    const dialog = await openLoginDialog();

    await userEvent.click(within(dialog).getByRole("button", { name: "ORCIDでログイン" }));

    expect(within(dialog).getByRole("heading", { name: "Accountsにログイン" })).toBeDefined();
    expect(within(dialog).getByRole("button", { name: "Googleでログイン" })).toBeDefined();
    expect(within(dialog).getByRole("button", { name: "GitHubでログイン" })).toBeDefined();
    expect(authClientMock.signIn.social).toHaveBeenCalledWith(expect.objectContaining({ provider: "orcid" }));
  });

  it("account_not_linkedは、既存のログイン手段からの明示連携をalertで案内する", async () => {
    const dialog = await openLoginDialog("account_not_linked");

    const alert = within(dialog).getByRole("alert");
    expect(alert.textContent).toContain("既存のログイン手段でログインし、「アカウント連携」画面から");
    expect(alert.textContent).toContain("元のAccountsユーザーを退会");
  });

  it("email_not_foundは、GitHubのメールアドレスを取得できない場合の対処をalertで案内する", async () => {
    const dialog = await openLoginDialog("email_not_found", "en");

    expect(within(dialog).getByRole("alert").textContent).toContain("Could not get an email address from GitHub");
  });

  it("その他のエラーは、汎用の失敗としてエラーコードを添えて案内する", async () => {
    const dialog = await openLoginDialog("state_mismatch");

    const alert = within(dialog).getByRole("alert");
    expect(alert.textContent).toContain("ログインできませんでした");
    expect(alert.textContent).toContain("state_mismatch");
  });

  it("ログインの要求が期限切れの場合は、元のサービスからやり直す案内と、ログイン画面を開き直す導線を示す", async () => {
    authClientMock.signIn.social.mockResolvedValue({
      data: null,
      error: { status: 400, statusText: "Bad Request", error: "invalid_signature" },
    });
    const dialog = await openLoginDialog();

    await userEvent.click(within(dialog).getByRole("button", { name: "GitHubでログイン" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert.textContent).toContain("元のサービスから連携を最初からやり直してください");
    const reopenLink = within(alert).getByRole("link", { name: "ログイン画面を開き直す" });
    expect(reopenLink.getAttribute("href")).toBe("/");

    await userEvent.click(reopenLink);

    expect(within(await screen.findByRole("dialog")).queryByRole("alert")).toBeNull();
  });

  it("エラーが無い場合は失敗の案内を表示しない", async () => {
    const dialog = await openLoginDialog();

    expect(within(dialog).queryByRole("alert")).toBeNull();
  });

  it("前回のログイン方法のボタンに「前回使用」のテキストを添える", async () => {
    authClientMock.getLastUsedLoginMethod.mockReturnValue("github");
    const dialog = await openLoginDialog();

    const githubItem = within(dialog).getByRole("button", { name: "GitHubでログイン" }).closest("li");
    expect(githubItem?.textContent).toContain("前回使用");
    expect(within(dialog).getAllByText("前回使用")).toHaveLength(1);
  });
});
