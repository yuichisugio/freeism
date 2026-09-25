import { describe, expect, it } from "vitest";

import type { PublicProfile } from "../usecases/profile/read-public-profile";
import { renderPublicProfileNotFoundPage, renderPublicProfilePage } from "./public-profile-page";

const verifiedAt = new Date("2026-09-01T00:00:00.000Z");

/**
 * GitHub（OAuth・リンク確認）と個人サイト（DNS TXT）を公開したプロフィール。
 */
const profile: PublicProfile = {
  accountsUserId: "ausr_alice",
  displayName: "Alice",
  externalAccounts: [
    {
      id: "eac_github",
      service: "github",
      displayName: "Alice Liddell",
      linkedAt: verifiedAt,
      identifiers: [
        { kind: "provider_account", provider: "github", value: "12345" },
        { kind: "provider_username", provider: "github", value: "alice" },
        { kind: "url", provider: "", value: "https://github.com/alice" },
      ],
      verifications: [
        {
          method: "oauth",
          verifiedAt,
          checkedAt: verifiedAt,
          result: "verified",
          evidenceUrl: null,
        },
        {
          method: "bidirectional_link",
          verifiedAt,
          checkedAt: new Date("2026-09-02T00:00:00.000Z"),
          result: "indeterminate",
          evidenceUrl: "https://github.com/alice",
        },
      ],
    },
    {
      id: "eac_web",
      service: null,
      displayName: null,
      linkedAt: verifiedAt,
      identifiers: [
        { kind: "url", provider: "", value: "https://alice.example.com/" },
        { kind: "url", provider: "", value: "https://alice.example.com/about" },
      ],
      verifications: [
        {
          method: "dns_txt",
          verifiedAt,
          checkedAt: verifiedAt,
          result: "verified",
          evidenceUrl: null,
        },
      ],
    },
  ],
};

describe("renderPublicProfilePage", () => {
  it("外部アカウントのURLすべてをrel=\"me\"付きのリンクにする", async () => {
    const html = await renderPublicProfilePage(profile);

    for (const url of [
      "https://github.com/alice",
      "https://alice.example.com/",
      "https://alice.example.com/about",
    ]) {
      expect(html).toContain(`<a href="${url}" rel="me">`);
    }
    expect(html).not.toContain(" key=");
    expect(html).toContain('証拠URL / Evidence: <a href="https://github.com/alice">');
  });

  it("表示名・固定ID・方法別のバッジ・検証日時・結果・証拠URLを日英併記で表示する", async () => {
    const html = await renderPublicProfilePage(profile);

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<h1>Alice</h1>");
    expect(html).toContain("AccountsユーザーID / Accounts user ID: <code>ausr_alice</code>");
    expect(html).toContain('<span class="badge">OAuth</span>');
    expect(html).toContain('<span class="badge">公開ページのリンク確認 / Public page link</span>');
    expect(html).toContain('<span class="badge">DNS TXT</span>');
    expect(html).toContain('<time datetime="2026-09-01T00:00:00.000Z">');
    expect(html).toContain("成功 / Verified");
    expect(html).toContain("判断できませんでした / Could not be determined");
    expect(html).toContain("GitHub — Alice Liddell");
    expect(html).toContain("ユーザー名 / Username: alice");
    expect(html).toContain("固有ID / Account ID: 12345");
    expect(html).toContain("<h3>Web</h3>");
  });

  it("外部アカウントが0件でもプロフィールを返す", async () => {
    const html = await renderPublicProfilePage({ ...profile, externalAccounts: [] });

    expect(html).toContain("<h1>Alice</h1>");
    expect(html).toContain("公開している外部アカウントはありません。 / No external accounts are public.");
    expect(html).not.toContain('rel="me"');
  });

  it("外部の表示名・値をエスケープし、https以外のURLはリンクにしない", async () => {
    const html = await renderPublicProfilePage({
      accountsUserId: "ausr_bob",
      displayName: '<script>alert("x")</script>',
      externalAccounts: [
        {
          id: "eac_github",
          service: "github",
          displayName: "<img src=x onerror=alert(1)>",
          linkedAt: null,
          identifiers: [{ kind: "url", provider: "", value: "javascript:alert(1)" }],
          verifications: [],
        },
      ],
    });

    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('href="javascript:');
  });
});

describe("renderPublicProfileNotFoundPage", () => {
  it("日英併記の見つからないページを返す", async () => {
    const html = await renderPublicProfileNotFoundPage();

    expect(html).toContain("プロフィールが見つかりません / Profile not found");
  });
});
