import { describe, expect, it } from "vitest";

import type { PublicProfile } from "../usecases/profile/read-public-profile";
import {
  readPublicProfileLanguage,
  renderPublicProfileNotFoundPage,
  renderPublicProfilePage,
} from "./public-profile-page";

const profileUrl = "https://accounts.example/profiles/ausr_alice";

/**
 * GitHub（OAuth・双方向リンク）、個人サイト（DNS TXT、URL2件）、Google（OAuth、URLなし）を公開したプロフィール。
 */
const profile: PublicProfile = {
  accountsUserId: "ausr_alice",
  displayName: "Alice",
  externalAccounts: [
    {
      id: "eac_github",
      service: "github",
      identifiers: [
        { kind: "provider_account", provider: "github", value: "12345" },
        { kind: "provider_username", provider: "github", value: "alice" },
        { kind: "url", provider: "", value: "https://github.com/alice" },
      ],
      methods: ["oauth", "bidirectional_link"],
      verifiedAt: new Date("2026-09-01T09:05:00.000Z"),
    },
    {
      id: "eac_web",
      service: null,
      identifiers: [
        { kind: "url", provider: "", value: "https://alice.example.com/" },
        { kind: "url", provider: "", value: "https://alice.example.com/about" },
      ],
      methods: ["dns_txt"],
      verifiedAt: new Date("2026-08-15T23:59:00.000Z"),
    },
    {
      id: "eac_google",
      service: "google",
      identifiers: [{ kind: "provider_account", provider: "google", value: "1098" }],
      methods: ["oauth"],
      verifiedAt: new Date("2026-09-02T00:00:00.000Z"),
    },
  ],
};

/**
 * HTMLから、指定した文字列を含む外部アカウントの項目（`<li>`）を切り出す。
 */
function findItem(html: string, text: string): string {
  const item = html.split("<li").find((part) => part.includes(text));
  if (item === undefined) {
    throw new Error(`item not found: ${text}`);
  }
  return item;
}

describe("readPublicProfileLanguage", () => {
  it.each([
    [undefined, "ja"],
    ["ja", "ja"],
    ["en", "en"],
    ["fr", "ja"],
    ["EN", "ja"],
  ])("lang=%s は %s にする", (value, expected) => {
    expect(readPublicProfileLanguage(value)).toBe(expected);
  });
});

describe("renderPublicProfilePage", () => {
  it("日本語では見出し・証明方法・証明日時を日本語だけで表示する", async () => {
    const html = await renderPublicProfilePage(profile, { language: "ja", profileUrl });

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain("<h2>証明済みのアカウント</h2>");
    expect(html).toContain("証明方法: OAuth・双方向リンク");
    expect(html).toContain("証明方法: DNS TXT");
    expect(html).toContain(
      '証明日時: <time datetime="2026-09-01T09:05:00.000Z">2026/09/01 09:05 (UTC)</time>',
    );
    expect(html).toContain("Freeism Accounts");
    expect(html).not.toContain("Verified external accounts");
    expect(html).not.toMatch(/Verified|Method/);
  });

  it("英語では見出し・証明方法・証明日時を英語だけで表示する", async () => {
    const html = await renderPublicProfilePage(profile, { language: "en", profileUrl });

    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<h2>Verified external accounts</h2>");
    expect(html).toContain("Method: OAuth, Two-way link");
    expect(html).toContain(
      'Verified: <time datetime="2026-08-15T23:59:00.000Z">2026/08/15 23:59 (UTC)</time>',
    );
    expect(html).toContain(">GitHub: alice</a>");
    expect(html).not.toMatch(/証明|日本語で|アカウント/);
  });

  it("表示名を見出しに、AccountsユーザーIDをその下に表示し、titleに表示名を入れる", async () => {
    const html = await renderPublicProfilePage(profile, { language: "en", profileUrl });

    expect(html).toContain("<title>Alice | Freeism Accounts</title>");
    expect(html).toContain('<h1>Alice</h1><span class="mono">ausr_alice</span>');
  });

  it("直近の結果・証拠URLを表示しない", async () => {
    const html = await renderPublicProfilePage(profile, { language: "ja", profileUrl });

    expect(html).not.toMatch(/成功|判断できません|証拠/);
  });

  it("「サービス名：識別子」を主URLへのrel=\"me\"リンクにし、ほかのURLは同じ項目に小さく並べる", async () => {
    const html = await renderPublicProfilePage(profile, { language: "ja", profileUrl });

    expect(html).toContain('<a href="https://github.com/alice" rel="me">GitHub：alice</a>');

    const webItem = findItem(html, "alice.example.com");
    const primary = '<a href="https://alice.example.com/" rel="me">Web：alice.example.com</a>';
    const other =
      '<a href="https://alice.example.com/about" rel="me">alice.example.com/about</a>';
    expect(webItem).toContain(primary);
    expect(webItem).toContain(other);
    expect(webItem.indexOf(primary)).toBeLessThan(webItem.indexOf(other));
  });

  it("URLを持たない行は「サービス名：識別子」をリンクにしない", async () => {
    const html = await renderPublicProfilePage(profile, { language: "ja", profileUrl });

    const googleItem = findItem(html, "Google：1098");
    expect(googleItem).not.toContain('rel="me"');
  });

  it("サービスアイコンをGoogleのfavicon配信から読み、背後に地球儀を置く", async () => {
    const html = await renderPublicProfilePage(profile, { language: "ja", profileUrl });

    for (const host of ["github.com", "alice.example.com", "google.com"]) {
      const src = `https://www.google.com/s2/favicons?domain=${host}&amp;sz=64`;
      expect(html).toContain(`<img class="favicon" src="${src}" alt=""`);
    }
    expect(findItem(html, "Google：1098")).toContain('<use href="#i-globe"');
  });

  it("両言語のalternateリンクと、JavaScriptなしの言語ドロップダウンを置く", async () => {
    const html = await renderPublicProfilePage(profile, { language: "en", profileUrl });

    expect(html).toContain(`<link rel="alternate" hreflang="ja" href="${profileUrl}?lang=ja"/>`);
    expect(html).toContain(`<link rel="alternate" hreflang="en" href="${profileUrl}?lang=en"/>`);
    expect(html).toMatch(/<details[^>]*>\s*<summary[^>]*>[\s\S]*English[\s\S]*<\/summary>/);
    expect(html).toContain('href="?lang=ja"');
    expect(html).toContain('href="?lang=en"');
    expect(html).not.toContain("<script");
  });

  it("外部の値をエスケープし、https以外のURLはリンクにしない", async () => {
    const html = await renderPublicProfilePage(
      {
        accountsUserId: "ausr_bob",
        displayName: '<script>alert("x")</script>',
        externalAccounts: [
          {
            id: "eac_github",
            service: "github",
            identifiers: [
              {
                kind: "provider_username",
                provider: "github",
                value: "<img src=x onerror=alert(1)>",
              },
              { kind: "url", provider: "", value: "javascript:alert(1)" },
            ],
            methods: ["oauth"],
            verifiedAt: new Date("2026-09-01T00:00:00.000Z"),
          },
        ],
      },
      { language: "ja", profileUrl },
    );

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
    expect(html).not.toContain('href="javascript:');
  });
});

describe("renderPublicProfileNotFoundPage", () => {
  it.each([
    ["ja", "このプロフィールは存在しません"],
    ["en", "Profile not found"],
  ] as const)("%s の存在しないページを、404の文字を出さずに返す", async (language, text) => {
    const html = await renderPublicProfileNotFoundPage(language);

    expect(html).toContain(`<html lang="${language}">`);
    expect(html).toContain(`<h1>${text}</h1>`);
    expect(html).not.toContain("404");
  });
});
