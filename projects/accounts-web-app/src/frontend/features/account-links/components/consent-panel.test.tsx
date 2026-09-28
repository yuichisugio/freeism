// @vitest-environment happy-dom
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../../test/render-with-providers";
import { createLinkedClient } from "../lib/account-links-fixtures";
import { ConsentPanel } from "./consent-panel";

describe("ConsentPanel", () => {
  const panelProps = {
    request: { clientId: "points", redirectHost: "points.example", expiresAt: null },
    client: createLinkedClient({ name: "Points", uri: "https://points.example/" }),
    isListReady: true,
    activeUser: { accountsUserId: "ausr_1", displayName: "Alice", profileUrl: "https://accounts.example/profiles/ausr_1" },
    isExpired: false,
    hasFailed: false,
    isSubmitting: false,
    canAccept: true,
    onAccept: vi.fn<() => void>(),
    onDeny: vi.fn<() => void>(),
  };

  it("連携先・戻り先のhost・アクティブユーザー・利用目的を表示する", async () => {
    renderWithProviders(<ConsentPanel {...panelProps} />);

    expect(await screen.findByText("Pointsが情報の提供を求めています")).toBeDefined();
    expect(screen.getByText("points.example")).toBeDefined();
    expect(screen.getByText("Alice (ausr_1)")).toBeDefined();
    expect(screen.getByText(/公開表示し、貢献者の照合に使うことがあります/)).toBeDefined();
    expect(screen.getByText("この画面は表示から10分で失効します。")).toBeDefined();
  });

  it("失効した場合はやり直しを案内し、2つの操作を非活性にする", async () => {
    renderWithProviders(<ConsentPanel {...panelProps} isExpired />);

    expect((await screen.findByRole("alert")).textContent).toContain("元のサービスから連携を最初からやり直してください");
    expect(screen.getByRole("button", { name: "同意して戻る" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "同意しない" }).hasAttribute("disabled")).toBe(true);
  });

  it("今回の連携先が一覧に無い場合は、やり直しを案内して「同意しない」だけを残す", async () => {
    renderWithProviders(<ConsentPanel {...panelProps} client={null} />);

    expect((await screen.findByRole("alert")).textContent).toContain("連携先のサービスが見つかりません");
    expect(screen.getByRole("button", { name: "同意して戻る" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "同意しない" }).hasAttribute("disabled")).toBe(false);
  });

  it("一覧の取得前は、連携先が無いことや選択が必要なことを表示しない", async () => {
    renderWithProviders(<ConsentPanel {...panelProps} client={null} isListReady={false} canAccept={false} />);

    await screen.findByText("この画面は表示から10分で失効します。");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/証明済みの外部アカウントを1件以上選択してください/)).toBeNull();
  });

  it("証明済みの選択が無い場合は「同意して戻る」だけを非活性にする", async () => {
    renderWithProviders(<ConsentPanel {...panelProps} canAccept={false} />);

    expect((await screen.findByRole("button", { name: "同意して戻る" })).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "同意しない" }).hasAttribute("disabled")).toBe(false);
  });
});
