// @vitest-environment happy-dom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../../test/render-with-providers";
import { HelpPage } from "./help-page";

/**
 * PC幅の目次（`nav`）のリンクの文字列を返す。
 */
function tableOfContents(): string[] {
  const nav = screen.getByRole("navigation", { name: "目次" });
  return within(nav)
    .getAllByRole("link")
    .map((link) => link.textContent ?? "");
}

/**
 * 表示中の質問（アコーディオンの開閉ボタン）を返す。
 */
function questionButtons(): HTMLElement[] {
  return screen.queryAllByRole("button").filter((button) => button.hasAttribute("aria-expanded"));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HelpPage", () => {
  it("h1「使い方」と、利用者向け・開発者向けの話題の目次を仕様の順に表示する", async () => {
    renderWithProviders(<HelpPage />);

    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("使い方");
    expect(tableOfContents()).toEqual([
      "はじめに",
      "ログインとユーザーの切替",
      "外部アカウントの追加",
      "URLの検証とDNS TXT",
      "公開設定",
      "連携解除",
      "データ出力とデータ取込",
      "退会",
      "各サービスでの連携許可の取消",
      "OAuthクライアントの登録",
      "APIドキュメント",
    ]);
  });

  it("開発者向けの話題の見出しに「開発者向け」の印を付ける", async () => {
    renderWithProviders(<HelpPage />);

    expect((await screen.findByRole("heading", { level: 2, name: /APIドキュメント/ })).textContent).toContain(
      "開発者向け",
    );
    expect(screen.getByRole("heading", { level: 2, name: "退会" }).textContent).not.toContain("開発者向け");
  });

  it("ほかの画面から`/help#id`で案内できるよう、話題の節に固定のidを付ける", async () => {
    renderWithProviders(<HelpPage />);

    expect((await screen.findByRole("heading", { level: 2, name: "外部アカウントの追加" })).closest("section")?.id).toBe(
      "account-links",
    );
  });

  it("質問は閉じた状態で表示し、押すと回答を開く", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HelpPage />);

    const question = await screen.findByRole("button", { name: "検証では何を確認しますか？" });
    expect(question.getAttribute("aria-expanded")).toBe("false");

    await user.click(question);

    expect(question.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/確認するのはリンクの存在で/)).toBeDefined();
  });

  it("絞り込みは質問と本文の部分一致（大文字・小文字を区別しない）で、一致した質問だけを開いて表示し、該当の無い話題は目次からも隠す", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HelpPage />);

    await user.type(await screen.findByRole("searchbox", { name: "絞り込み" }), "_ACCOUNTS.");

    // 「ページにリンクを載せられないときは？」は本文だけが一致する。
    expect(questionButtons().map((button) => button.textContent)).toEqual([
      "ページにリンクを載せられないときは？（DNS TXT）",
    ]);
    expect(questionButtons()[0]?.getAttribute("aria-expanded")).toBe("true");
    expect(tableOfContents()).toEqual(["URLの検証とDNS TXT"]);
    expect(screen.queryByRole("heading", { level: 2, name: "退会" })).toBeNull();
  });

  it("絞り込みを消すと、すべての話題を閉じた状態に戻す", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HelpPage />);
    const filter = await screen.findByRole("searchbox", { name: "絞り込み" });

    await user.type(filter, "退会");
    await user.clear(filter);

    expect(tableOfContents()).toHaveLength(11);
    expect(questionButtons().every((button) => button.getAttribute("aria-expanded") === "false")).toBe(true);
  });

  it("絞り込みに一致する項目が無ければ、その旨を表示する", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HelpPage />);

    await user.type(await screen.findByRole("searchbox", { name: "絞り込み" }), "存在しない語句");

    expect(screen.getByText("該当する項目はありません。")).toBeDefined();
    expect(questionButtons()).toHaveLength(0);
  });

  it("目次のリンクを押すと、その話題の節へスクロールする", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn<(options?: boolean | ScrollIntoViewOptions) => void>();
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(scrollIntoView);
    renderWithProviders(<HelpPage />);

    const nav = await screen.findByRole("navigation", { name: "目次" });
    await user.click(within(nav).getByRole("link", { name: "退会" }));

    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById("withdrawal"));
  });

  it("同意画面の失効時間は案内しない", async () => {
    renderWithProviders(<HelpPage />);

    await screen.findByRole("heading", { level: 1 });
    expect(document.body.textContent).not.toContain("10分");
  });

  it("APIドキュメントの話題で、2つのQUERY操作・認証方式・スコープ・メタデータの経路とOpenAPI JSONへのリンクを示す", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HelpPage />);

    await user.click(await screen.findByRole("button", { name: "APIの仕様はどこで確認できますか？" }));
    const openApiLink = screen.getByRole("link", { name: /Freeism Accounts API（OpenAPI）/ });
    expect(openApiLink.getAttribute("href")).toBe("/api/v1/openapi.json");
    expect(openApiLink.getAttribute("target")).toBe("_blank");

    const apiTopic = screen.getByRole("heading", { level: 2, name: /APIドキュメント/ }).closest("section");
    const apiText = apiTopic?.textContent ?? "";
    expect(apiText).toContain("QUERY /api/v1/external-accounts");
    expect(apiText).toContain("QUERY /api/v1/identities/resolve");
    expect(apiText).toContain("private_key_jwt");
    expect(apiText).toContain("DPoP");
    expect(apiText).toContain("identities:read");
    expect(apiText).toContain("/.well-known/openid-configuration");
    expect(apiText).toContain("/.well-known/oauth-authorization-server");
    expect(apiText).toContain("/.well-known/oauth-protected-resource/api/v1");
  });

  it("本文の`コード`は`code`要素で表示する", async () => {
    renderWithProviders(<HelpPage />);

    await screen.findByRole("heading", { level: 1 });
    const codes = Array.from(document.querySelectorAll("code")).map((code) => code.textContent);
    expect(codes).toContain("_accounts.{host}");
  });

  it("Google・GitHub・ORCIDの連携許可を取り消す設定画面へ、新しいタブで案内する", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HelpPage />, { language: "en" });

    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Guide");
    await user.type(screen.getByRole("searchbox", { name: "Filter" }), "connected apps");

    const googleLink = screen.getByRole("link", { name: /Google settings/ });
    expect(googleLink.getAttribute("href")).toBe("https://myaccount.google.com/connections");
    expect(googleLink.getAttribute("target")).toBe("_blank");
    expect(screen.getByRole("link", { name: /GitHub settings/ }).getAttribute("href")).toBe(
      "https://github.com/settings/applications",
    );
    expect(screen.getByRole("link", { name: /ORCID settings/ }).getAttribute("href")).toBe(
      "https://orcid.org/trusted-parties",
    );
  });
});
