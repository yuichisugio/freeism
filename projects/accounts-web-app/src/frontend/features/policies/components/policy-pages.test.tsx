// @vitest-environment happy-dom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "../../../test/render-with-providers";
import { PrivacyPolicyPage, TermsOfUsePage } from "./policy-pages";

/**
 * h2の見出しの一覧を返す。
 */
function sectionTitles(): (string | null)[] {
  return screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
}

describe("PrivacyPolicyPage", () => {
  it("保持する情報・公開先・連携解除と退会・バックアップ・運営者による確認の扱いを節ごとに示す", async () => {
    renderWithProviders(<PrivacyPolicyPage />);

    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("プライバシーポリシー");
    expect(sectionTitles()).toEqual(
      expect.arrayContaining([
        "保存する情報",
        "保存しない情報",
        "一般公開と連携先サービスへの提供",
        "連携解除と退会",
        "バックアップと移行",
        "運営者による確認と利用の停止",
      ]),
    );
    expect(screen.getByText(/メールアドレス・OAuthのトークン・セッション/)).toBeDefined();
    expect(screen.getByText(/IPアドレスとブラウザーの種類（User-Agent）/)).toBeDefined();
  });

  it("英語でも表示する", async () => {
    renderWithProviders(<PrivacyPolicyPage />, { language: "en" });

    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Privacy policy");
    expect(sectionTitles()).toContain("Backup and migration");
  });
});

describe("TermsOfUsePage", () => {
  it("利用規約の基本事項を節ごとに示す", async () => {
    renderWithProviders(<TermsOfUsePage />);

    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("利用規約");
    expect(sectionTitles()).toEqual(expect.arrayContaining(["禁止事項", "利用の停止", "退会", "免責", "規約の変更"]));
  });

  it("英語でも表示する", async () => {
    renderWithProviders(<TermsOfUsePage />, { language: "en" });

    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Terms of use");
  });
});
