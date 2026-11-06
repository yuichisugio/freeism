import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { AccountsExternalAccountList } from "./accounts-external-account-list";

describe("AccountsExternalAccountList", () => {
  it("Accountsが返した項目をテキストで示し、URLだけをリンクにする", () => {
    const html = renderToStaticMarkup(
      <AccountsExternalAccountList
        externalAccounts={[
          {
            service: "github",
            displayName: "<b>Alice</b>",
            identifiers: [
              { type: "provider_username", provider: "github", username: "alice" },
              { type: "provider_account", provider: "github", accountId: "123" },
              { type: "url", url: "https://github.com/alice" },
              { type: "url", url: "javascript:alert(1)" },
            ],
            linkedAt: "2026-09-01T00:00:00Z",
            verificationStatus: "verified",
            verifications: [
              {
                method: "oauth",
                result: "verified",
                verifiedAt: "2026-09-01T00:00:00Z",
                checkedAt: "2026-09-02T00:00:00Z",
                evidenceUrl: null,
              },
            ],
          },
          {
            service: null,
            displayName: null,
            identifiers: [{ type: "url", url: "https://example.org/" }],
            linkedAt: null,
            verificationStatus: "unverified",
            verifications: [],
          },
        ]}
      />,
    );

    expect(html).toContain("&lt;b&gt;Alice&lt;/b&gt;");
    expect(html).toContain("github: @alice");
    expect(html).toContain("github ID: 123");
    expect(html).toContain(
      '<a href="https://github.com/alice" rel="me nofollow noopener noreferrer ugc">https://github.com/alice</a>',
    );
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("javascript:alert(1)");
    expect(html).toContain("確認済み");
    expect(html).toContain("未確認");
  });

  it("連携日時と証明の方法・結果・日時・証拠URLを示し、証拠URLはHTTP(S)だけをリンクにする", () => {
    const html = renderToStaticMarkup(
      <AccountsExternalAccountList
        externalAccounts={[
          {
            service: "website",
            displayName: null,
            identifiers: [{ type: "url", url: "https://alice.example/" }],
            linkedAt: "2026-09-01T00:00:00Z",
            verificationStatus: "verified",
            verifications: [
              {
                method: "bidirectional_link",
                result: "verified",
                verifiedAt: "2026-09-03T00:00:00Z",
                checkedAt: "2026-09-04T00:00:00Z",
                evidenceUrl: "https://alice.example/about",
              },
              {
                method: "dns_txt",
                result: "indeterminate",
                verifiedAt: null,
                checkedAt: "2026-09-05T00:00:00Z",
                evidenceUrl: "javascript:alert(1)",
              },
            ],
          },
        ]}
      />,
    );

    expect(html).toContain('連携日時: <time dateTime="2026-09-01T00:00:00Z">');
    expect(html).toContain("公開ページのリンク確認: 成功");
    expect(html).toContain('検証日時: <time dateTime="2026-09-03T00:00:00Z">');
    expect(html).toContain('確認日時: <time dateTime="2026-09-04T00:00:00Z">');
    expect(html).toContain(
      '<a href="https://alice.example/about" rel="nofollow noopener noreferrer ugc">https://alice.example/about</a>',
    );
    expect(html).toContain("DNS TXT: 判断できませんでした");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("証拠: javascript:alert(1)");
  });

  it("外部アカウントが無い場合はその旨を示す", () => {
    const html = renderToStaticMarkup(<AccountsExternalAccountList externalAccounts={[]} />);

    expect(html).toContain("公開されている外部アカウントはありません。");
  });
});
