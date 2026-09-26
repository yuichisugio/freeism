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
            verificationStatus: "verified",
          },
          {
            service: null,
            displayName: null,
            identifiers: [{ type: "url", url: "https://example.org/" }],
            verificationStatus: "unverified",
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

  it("外部アカウントが無い場合はその旨を示す", () => {
    const html = renderToStaticMarkup(<AccountsExternalAccountList externalAccounts={[]} />);

    expect(html).toContain("公開されている外部アカウントはありません。");
  });
});
