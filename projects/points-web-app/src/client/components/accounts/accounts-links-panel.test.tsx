import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import {
  AccountsLinkList,
  AccountsLinkResultMessage,
  AccountsLinkStartForm,
  type AccountsLinkView,
} from "./accounts-links-panel";

const baseLink: AccountsLinkView = {
  id: "alnk_1",
  accountsConnection: {
    id: "acon_1",
    displayName: "Freeism Accounts",
    accountsOrigin: "https://accounts.example.test",
    status: "ACTIVE",
  },
  accountsUserId: "ausr_1",
  accountsProfileUrl: "https://accounts.example.test/profiles/ausr_1",
  accountsManagementUrl: "https://accounts.example.test/account-links",
  provisionStatus: "PROVIDED",
  fetchedAt: "2026-09-26T00:00:00.000Z",
  externalAccounts: [
    {
      service: "github",
      displayName: "Alice",
      identifiers: [{ type: "url", url: "https://github.com/alice" }],
      verificationStatus: "verified",
    },
  ],
};

function renderList(links: AccountsLinkView[]) {
  return renderToStaticMarkup(
    <AccountsLinkList links={links} onDelete={() => {}} onRelink={() => {}} pending={false} />,
  );
}

describe("AccountsLinkList", () => {
  it("提供元・Accounts ID・状態・外部アカウント・Accountsへのリンク・解除を示す", () => {
    const html = renderList([baseLink]);

    expect(html).toContain("Freeism Accounts");
    expect(html).toContain("https://accounts.example.test");
    expect(html).toContain("ausr_1");
    expect(html).toContain("提供中");
    expect(html).toContain("Alice");
    expect(html).toContain('href="https://accounts.example.test/account-links"');
    expect(html).toContain('href="https://accounts.example.test/profiles/ausr_1"');
    expect(html).toContain("解除");
    expect(html).toContain("再連携");
  });

  it("情報提供の停止と未取得をテキストで示し、停止中も解除できる", () => {
    const html = renderList([
      { ...baseLink, provisionStatus: "NOT_PROVIDED", externalAccounts: null },
      { ...baseLink, id: "alnk_2", provisionStatus: null, externalAccounts: null, fetchedAt: null },
    ]);

    expect(html).toContain("情報提供が停止しています");
    expect(html).toContain("未取得");
    expect(html.match(/解除/g)).toHaveLength(2);
  });

  it("接続先が取り下げられた連携は再連携を出さない", () => {
    const html = renderList([
      { ...baseLink, accountsConnection: { ...baseLink.accountsConnection, status: "WITHDRAWN" } },
    ]);

    expect(html).not.toContain("再連携");
  });

  it("連携が無い場合はその旨を示す", () => {
    expect(renderList([])).toContain("Accountsとの連携はありません。");
  });
});

describe("AccountsLinkStartForm", () => {
  it("接続先を選んで連携を始める", () => {
    const html = renderToStaticMarkup(
      <AccountsLinkStartForm
        connections={[
          { id: "acon_1", displayName: "Freeism Accounts", accountsOrigin: "https://a.test" },
        ]}
        onStart={() => {}}
        pending={false}
      />,
    );

    expect(html).toContain("Freeism Accounts（https://a.test）");
    expect(html).toContain("Accountsと連携する");
  });

  it("接続先が無い場合は開始できない", () => {
    const html = renderToStaticMarkup(
      <AccountsLinkStartForm connections={[]} onStart={() => {}} pending={false} />,
    );

    expect(html).toContain("連携できるAccountsはまだありません。");
    expect(html).not.toContain("Accountsと連携する</button>");
  });
});

describe("AccountsLinkResultMessage", () => {
  it("戻り先の結果を案内する", () => {
    expect(
      renderToStaticMarkup(<AccountsLinkResultMessage result="LINKED" error={null} />),
    ).toContain("Accountsと連携しました。");
    expect(
      renderToStaticMarkup(
        <AccountsLinkResultMessage
          result={null}
          error="ACCOUNTS_USER_LINKED_TO_OTHER_POINTS_USER"
        />,
      ),
    ).toContain("別のPointsアカウントに連携済み");
    expect(renderToStaticMarkup(<AccountsLinkResultMessage result={null} error={null} />)).toBe("");
  });
});
