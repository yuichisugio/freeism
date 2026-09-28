// @vitest-environment happy-dom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../../test/render-with-providers";
import { SaveBar } from "./save-bar";

describe("SaveBar", () => {
  it("未保存の変更が無いときは、その旨を示して「破棄」と保存を無効にする", async () => {
    renderWithProviders(<SaveBar dirtyCount={0} saveLabel="公開設定を保存" onDiscard={vi.fn<() => void>()} onSave={vi.fn<() => void>()} />);

    expect(await screen.findByText("未保存の変更なし")).toBeDefined();
    expect(screen.getByRole("button", { name: "破棄" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "公開設定を保存" }).hasAttribute("disabled")).toBe(true);
  });

  it("狭い幅では状態を小さい文字にして間隔を詰め、状態と2つのボタンを1行に収める", async () => {
    renderWithProviders(<SaveBar dirtyCount={0} saveLabel="公開設定を保存" onDiscard={vi.fn<() => void>()} onSave={vi.fn<() => void>()} />);

    const status = await screen.findByText("未保存の変更なし");
    const bar = screen.getByRole("status").parentElement!;
    expect(status.className).toContain("max-sm:text-xs");
    expect(bar.className).toContain("max-sm:gap-2");
    expect(bar.className).not.toContain("flex-wrap");
  });

  it("未保存の変更があるときは、件数を示して「破棄」と保存を押せる", async () => {
    const onDiscard = vi.fn<() => void>();
    const onSave = vi.fn<() => void>();
    renderWithProviders(<SaveBar dirtyCount={2} saveLabel="保存" onDiscard={onDiscard} onSave={onSave} />);

    expect(await screen.findByText("未保存 2件")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "破棄" }));
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(onDiscard).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("保存できない入力があるときは、変更があっても保存だけを無効にする", async () => {
    renderWithProviders(
      <SaveBar dirtyCount={1} saveLabel="保存" isSaveDisabled onDiscard={vi.fn<() => void>()} onSave={vi.fn<() => void>()} />,
    );

    expect((await screen.findByRole("button", { name: "保存" })).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "破棄" }).hasAttribute("disabled")).toBe(false);
  });
});
