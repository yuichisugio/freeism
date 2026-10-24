// @vitest-environment happy-dom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { BffError } from "../../../lib/api-client";
import { renderWithProviders } from "../../../test/render-with-providers";
import { ErrorNotice } from "./status-messages";

describe("ErrorNotice", () => {
  it("ログインしていない失敗は、alertとして示し、「ログインする」からログイン用のダイアログを開ける", async () => {
    renderWithProviders(<ErrorNotice error={new BffError(401, null)} />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("ログインが必要です");
    await userEvent.click(within(alert).getByRole("button", { name: "ログインする" }));

    expect(within(await screen.findByRole("dialog")).getByRole("button", { name: "Googleでログイン" })).toBeDefined();
  });

  it("画面ごとのエラーコードの文言を優先する", async () => {
    const error = new BffError(409, { type: "about:blank", title: "Conflict", status: 409, code: "URL_LIMIT_REACHED" });

    renderWithProviders(<ErrorNotice error={error} codeMessages={{ URL_LIMIT_REACHED: "上限です" }} />, { language: "en" });

    expect((await screen.findByRole("alert")).textContent).toContain("上限です");
  });

  it("応答が想定外の形の場合は通信の失敗と区別する", async () => {
    renderWithProviders(<ErrorNotice error={new SyntaxError("Unexpected token <")} />);

    expect((await screen.findByRole("alert")).textContent).toContain("想定外の応答");
  });

  it("通信の失敗は接続の確認を案内する", async () => {
    renderWithProviders(<ErrorNotice error={new TypeError("Failed to fetch")} />, { language: "en" });

    expect((await screen.findByRole("alert")).textContent).toContain("check your connection");
  });
});
