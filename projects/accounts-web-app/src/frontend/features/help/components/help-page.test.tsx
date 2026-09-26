// @vitest-environment happy-dom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "../../../test/render-with-providers";
import { HelpPage } from "./help-page";

describe("HelpPage", () => {
  it("h1の下に、ログイン・外部アカウントの追加・公開設定などの使い方の節をh2で表示する", async () => {
    renderWithProviders(<HelpPage />);

    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("ヘルプ");
    const sectionTitles = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(sectionTitles).toEqual(
      expect.arrayContaining(["ログインとユーザーの切替", "外部アカウントの追加", "公開設定", "連携解除", "バックアップと復元"]),
    );
    expect(sectionTitles).not.toContain("保存する情報");
  });

  it("「アカウント連携」画面から案内する節に、リンク先のidを付ける", async () => {
    renderWithProviders(<HelpPage />);

    expect((await screen.findByRole("heading", { name: "外部アカウントの追加" })).closest("section")?.id).toBe(
      "account-links",
    );
  });

  it("Google・GitHub・ORCIDの連携許可を取り消す設定画面へ、新しいタブで案内する", async () => {
    renderWithProviders(<HelpPage />, { language: "en" });

    const googleLink = await screen.findByRole("link", { name: "Google settings" });
    expect(googleLink.getAttribute("href")).toBe("https://myaccount.google.com/connections");
    expect(googleLink.getAttribute("target")).toBe("_blank");
    expect(screen.getByRole("link", { name: "GitHub settings" }).getAttribute("href")).toBe(
      "https://github.com/settings/applications",
    );
    expect(screen.getByRole("link", { name: "ORCID settings" }).getAttribute("href")).toBe(
      "https://orcid.org/trusted-parties",
    );
  });
});
