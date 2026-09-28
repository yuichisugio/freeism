// @vitest-environment happy-dom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { dataResponse, problemResponse } from "../../../test/bff-responses";
import { renderWithProviders } from "../../../test/render-with-providers";
import { useOAuthClients } from "../hooks/use-oauth-clients";
import { buildClient, stubBff } from "../test/oauth-client-fixtures";
import { DeveloperSection } from "./developer-section";

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * 「その他」画面と同じくフックの状態をビューへ渡す。
 */
function DeveloperSectionHarness() {
  return <DeveloperSection state={useOAuthClients()} />;
}

/**
 * 登録済みクライアントの一覧を返すBFFを用意して描画する。
 */
function renderSection(clientCount: number, route: Parameters<typeof stubBff>[0] = () => undefined) {
  const clients = Array.from({ length: clientCount }, (_, index) => buildClient(index + 1));
  stubBff((request) => {
    if (request.method === "GET" && request.url === "/api/oauth-clients") return dataResponse({ clients });
    return route(request);
  });
  renderWithProviders(<DeveloperSectionHarness />);
}

/**
 * 一覧の「編集」を押してフォームを開く。
 */
async function openEditor(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole("button", { name: `${name}を編集` }));
  return screen.findByRole("textbox", { name: /アプリ名/ });
}

describe("DeveloperSection: 一覧", () => {
  it("0件なら登録済みのクライアントが無いことを表示し、フォームは閉じている", async () => {
    renderSection(0);

    expect(await screen.findByText("登録済みのクライアントはありません。")).toBeDefined();
    expect(screen.getByRole("button", { name: "新しいクライアントを登録" }).hasAttribute("disabled")).toBe(false);
    expect(screen.queryByRole("textbox", { name: /アプリ名/ })).toBeNull();
  });

  it("登録済みのクライアントのアプリ名とClient IDを表で示し、Client IDをコピーできる", async () => {
    const user = userEvent.setup();
    renderSection(2);

    const row = (await screen.findByRole("cell", { name: "App 1" })).closest("tr")!;
    expect(within(row).getByText("client-1")).toBeDefined();
    expect(within(row).getByRole("button", { name: "App 1を編集" })).toBeDefined();
    expect(within(row).getByRole("button", { name: "App 1を削除" })).toBeDefined();
    await user.click(within(row).getByRole("button", { name: "App 1のClient IDをコピー" }));

    expect(await navigator.clipboard.readText()).toBe("client-1");
    expect(screen.queryByRole("textbox", { name: /アプリ名/ })).toBeNull();
  });

  it("5件に達したら登録の操作を無効にし、上限の理由を表示する", async () => {
    renderSection(5);

    await screen.findByRole("cell", { name: "App 5" });
    expect(screen.getByRole("button", { name: "新しいクライアントを登録" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/登録できるクライアントは5件までです/)).toBeDefined();
  });
});

describe("DeveloperSection: 登録・編集フォーム", () => {
  it("「新しいクライアントを登録」で空のフォームを開き、Client IDの欄は置かない", async () => {
    const user = userEvent.setup();
    renderSection(0);

    await user.click(await screen.findByRole("button", { name: "新しいクライアントを登録" }));

    const form = screen.getByRole("form", { name: "新しいクライアントを登録" });
    const nameInput = within(form).getByRole<HTMLInputElement>("textbox", { name: /アプリ名/ });
    expect(nameInput.value).toBe("");
    expect(nameInput.placeholder).toBe("例: Points");
    expect(within(form).getByRole<HTMLInputElement>("textbox", { name: "リダイレクトURL 1" }).placeholder).toBe(
      "https://points.freeism.app/auth/accounts/callback",
    );
    expect(within(form).queryByText("Client ID")).toBeNull();
    expect(within(form).queryByText("アプリ情報")).toBeNull();
    expect(within(form).queryByText(/（任意）/)).toBeNull();
  });

  it("「編集」でクライアントの内容とClient IDを表示し、変更するまで保存ボタンを非活性にする", async () => {
    const user = userEvent.setup();
    renderSection(1);

    const nameInput = await openEditor(user, "App 1");
    expect((nameInput as HTMLInputElement).value).toBe("App 1");
    expect(screen.getByRole("form", { name: "App 1" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Client IDをコピー" })).toBeDefined();
    const saveButton = screen.getByRole("button", { name: "保存" });
    expect(saveButton.hasAttribute("disabled")).toBe(true);

    await user.type(nameInput, " 改");

    expect(saveButton.hasAttribute("disabled")).toBe(false);
  });

  it("「キャンセル」でフォームを閉じ、入力を破棄する", async () => {
    const user = userEvent.setup();
    renderSection(1);

    await user.type(await openEditor(user, "App 1"), " 改");
    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(screen.queryByRole("textbox", { name: /アプリ名/ })).toBeNull();
    expect(((await openEditor(user, "App 1")) as HTMLInputElement).value).toBe("App 1");
  });

  it("リダイレクトURLは「追加」で欄を増やし、1欄だけのときは「削除」を無効にする", async () => {
    const user = userEvent.setup();
    renderSection(1);

    await openEditor(user, "App 1");
    expect(screen.getByRole("button", { name: "リダイレクトURL 1を削除" }).hasAttribute("disabled")).toBe(true);
    await user.click(screen.getByRole("button", { name: "リダイレクトURLを追加" }));

    expect(screen.getByRole("textbox", { name: "リダイレクトURL 2" })).toBeDefined();
    expect(screen.getByRole("button", { name: "リダイレクトURL 1を削除" }).hasAttribute("disabled")).toBe(false);
  });

  it("公開鍵のJSON構文が不正なら入力欄にエラーを表示し、保存できない", async () => {
    const user = userEvent.setup();
    renderSection(1);

    await openEditor(user, "App 1");
    const jwksInput = screen.getByRole("textbox", { name: /公開鍵/ });
    await user.clear(jwksInput);
    await user.type(jwksInput, "{{");

    expect(await screen.findByText("JSONの構文が正しくありません。")).toBeDefined();
    expect(screen.getByRole("button", { name: "保存" }).hasAttribute("disabled")).toBe(true);
  });

  it("公開鍵の保存だけ失敗した場合は、再保存の案内をalertで表示する", async () => {
    const user = userEvent.setup();
    renderSection(1, (request) => (request.method === "PUT" ? problemResponse(500, "CLIENT_KEY_SAVE_FAILED") : undefined));

    await user.type(await openEditor(user, "App 1"), " 改");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect((await screen.findByRole("alert")).textContent).toContain("同じ内容で再度保存すると反映されます");
  });

  it("入力不備の応答は、公開鍵の欄に項目ごとの内容を表示する", async () => {
    const user = userEvent.setup();
    renderSection(1, (request) =>
      request.method === "PUT"
        ? problemResponse(400, "INVALID_VALUE", [{ code: "INVALID_VALUE", message: "kid is duplicated", path: ["jwks"] }])
        : undefined,
    );

    await user.type(await openEditor(user, "App 1"), " 改");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect((await screen.findByRole("alert")).textContent).toContain("値が条件を満たしていません");
    expect(screen.getByText("kid is duplicated")).toBeDefined();
  });

  it("未保存の変更がある状態で別のクライアントを開くと確認を表示し、編集に戻ると入力内容を維持する", async () => {
    const user = userEvent.setup();
    renderSection(2);

    await user.type(await openEditor(user, "App 1"), " 改");
    await user.click(screen.getByRole("button", { name: "App 2を編集" }));

    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "編集に戻る" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: /アプリ名/ }).value).toBe("App 1 改");
  });
});

describe("DeveloperSection: 削除", () => {
  it("一覧の「削除」から確認して削除すると一覧から外し、削除したことを表示する", async () => {
    const user = userEvent.setup();
    renderSection(1, (request) => (request.method === "DELETE" ? dataResponse({ ok: true }) : undefined));

    await user.click(await screen.findByRole("button", { name: "App 1を削除" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("発行済みのトークンによるAPIの利用も止まります");
    await user.click(within(dialog).getByRole("button", { name: "削除" }));

    expect(await screen.findByText("削除しました。")).toBeDefined();
    expect(screen.getByText("登録済みのクライアントはありません。")).toBeDefined();
  });
});
