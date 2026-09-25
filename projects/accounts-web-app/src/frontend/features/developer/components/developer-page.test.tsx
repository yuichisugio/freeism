// @vitest-environment happy-dom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../../test/render-with-providers";
import { useOAuthClients } from "../hooks/use-oauth-clients";
import { dataResponse, problemResponse } from "../../../test/bff-responses";
import { buildClient, stubBff } from "../test/oauth-client-fixtures";
import { DeveloperPage } from "./developer-page";

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * routeと同じくフックの状態をビューへ渡す。
 */
function DeveloperPageHarness() {
  return <DeveloperPage state={useOAuthClients()} />;
}

/**
 * 登録済みクライアントの一覧を返すBFFを用意して画面を描画する。
 */
function renderPage(clientCount: number, route: Parameters<typeof stubBff>[0] = () => undefined) {
  const clients = Array.from({ length: clientCount }, (_, index) => buildClient(index + 1));
  stubBff((request) => {
    if (request.method === "GET" && request.url === "/api/oauth-clients") return dataResponse({ clients });
    return route(request);
  });
  renderWithProviders(<DeveloperPageHarness />);
}

describe("DeveloperPage", () => {
  it("0件なら登録済みのクライアントが無いことと新規登録の操作を表示する", async () => {
    renderPage(0);

    expect(await screen.findByText("登録済みのクライアントはありません。")).toBeDefined();
    expect(screen.getByRole("button", { name: "新規登録" }).hasAttribute("disabled")).toBe(false);
  });

  it("OpenAPIのドキュメントへのリンクを表示する", async () => {
    renderPage(0);

    expect((await screen.findByRole("link", { name: "Accounts API（OpenAPI）" })).getAttribute("href")).toBe(
      "/api/v1/openapi.json",
    );
    expect(screen.getByRole("link", { name: "Better Auth API（OpenAPI）" }).getAttribute("href")).toBe(
      "/api/auth/reference",
    );
  });

  it("5件に達したら新規登録を非活性にし、上限の理由を表示する", async () => {
    renderPage(5);

    await screen.findByRole("button", { name: "App 5" });
    expect(screen.getByRole("button", { name: "新規登録" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/登録できるクライアントは5件までです/)).toBeDefined();
  });

  it("選択中のクライアントの詳細とClient IDを表示し、変更するまで保存ボタンを非活性にする", async () => {
    const user = userEvent.setup();
    renderPage(1);

    const nameInput = await screen.findByRole("textbox", { name: /アプリ名/ });
    expect(screen.getByRole("button", { name: "App 1" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("client-1")).toBeDefined();
    const saveButton = screen.getByRole("button", { name: "保存" });
    expect(saveButton.hasAttribute("disabled")).toBe(true);

    await user.type(nameInput, " 改");

    expect(saveButton.hasAttribute("disabled")).toBe(false);
  });

  it("公開鍵のJSON構文が不正なら入力欄にエラーを表示し、保存できない", async () => {
    const user = userEvent.setup();
    renderPage(1);

    const jwksInput = await screen.findByRole("textbox", { name: /公開鍵/ });
    await user.clear(jwksInput);
    await user.type(jwksInput, "{{");

    expect(await screen.findByText("JSONの構文が正しくありません。")).toBeDefined();
    expect(screen.getByRole("button", { name: "保存" }).hasAttribute("disabled")).toBe(true);
  });

  it("公開鍵の保存だけ失敗した場合は、再保存の案内をalertで表示する", async () => {
    const user = userEvent.setup();
    renderPage(1, (request) => (request.method === "PUT" ? problemResponse(500, "CLIENT_KEY_SAVE_FAILED") : undefined));

    await user.type(await screen.findByRole("textbox", { name: /アプリ名/ }), " 改");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect((await screen.findByRole("alert")).textContent).toContain("同じ内容で再度保存すると反映されます");
  });

  it("入力不備の応答は、公開鍵の欄に項目ごとの内容を表示する", async () => {
    const user = userEvent.setup();
    renderPage(1, (request) =>
      request.method === "PUT"
        ? problemResponse(400, "INVALID_VALUE", [{ code: "INVALID_VALUE", message: "kid is duplicated", path: ["jwks"] }])
        : undefined,
    );

    await user.type(await screen.findByRole("textbox", { name: /アプリ名/ }), " 改");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect((await screen.findByRole("alert")).textContent).toContain("値が条件を満たしていません");
    expect(screen.getByText("kid is duplicated")).toBeDefined();
  });

  it("未保存の変更がある状態で別のクライアントを選ぶと確認を表示し、編集に戻ると入力内容を維持する", async () => {
    const user = userEvent.setup();
    renderPage(2);

    const nameInput = await screen.findByRole("textbox", { name: /アプリ名/ });
    await user.type(nameInput, " 改");
    await user.click(screen.getByRole("button", { name: "App 2" }));

    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "編集に戻る" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect((screen.getByRole("textbox", { name: /アプリ名/ }) as HTMLInputElement).value).toBe("App 1 改");
  });

  it("削除の確認で削除すると一覧から外し、削除したことを表示する", async () => {
    const user = userEvent.setup();
    renderPage(1, (request) => (request.method === "DELETE" ? dataResponse({ ok: true }) : undefined));

    await user.click(await screen.findByRole("button", { name: "削除" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("発行済みのトークンによるAPIの利用も止まります");
    await user.click(within(dialog).getByRole("button", { name: "削除" }));

    expect(await screen.findByText("削除しました。")).toBeDefined();
    expect(screen.getByText("登録済みのクライアントはありません。")).toBeDefined();
  });
});
