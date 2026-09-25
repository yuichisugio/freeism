// @vitest-environment happy-dom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "../../../test/render-with-providers";
import { HelpPage } from "./help-page";

describe("HelpPage", () => {
  it("h1の下に、情報の保持・提供・連携解除・バックアップなどの節をh2で表示する", async () => {
    renderWithProviders(<HelpPage />);

    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("ヘルプ・プライバシー");
    const sectionTitles = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(sectionTitles).toEqual(
      expect.arrayContaining(["保存する情報", "一般公開と連携先サービスへの提供", "連携解除", "バックアップと移行", "退会"]),
    );
  });

  it("Google・GitHub・ORCIDの連携許可を取り消す設定画面へ案内する", async () => {
    renderWithProviders(<HelpPage />, { language: "en" });

    expect((await screen.findByRole("link", { name: "Google settings" })).getAttribute("href")).toBe(
      "https://myaccount.google.com/connections",
    );
    expect(screen.getByRole("link", { name: "GitHub settings" }).getAttribute("href")).toBe(
      "https://github.com/settings/applications",
    );
    expect(screen.getByRole("link", { name: "ORCID settings" }).getAttribute("href")).toBe(
      "https://orcid.org/trusted-parties",
    );
  });
});
