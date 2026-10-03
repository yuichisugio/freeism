// @vitest-environment happy-dom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { LinkedVerification } from "../../../../shared/schemas/account-link-schema";
import { renderWithProviders } from "../../../test/render-with-providers";
import { createAccountLinks, createLinkedAccount, createLinkedClient } from "../lib/account-links-fixtures";
import { buildVisibilityTable, emptyVisibilityEdits, setSelection } from "../lib/visibility-draft";
import type { Destination } from "../lib/visibility-draft";
import { ExternalUrlForm } from "./external-url-form";
import { ProfileUrlPanel } from "./profile-url-panel";
import { ProviderLinkButtons } from "./provider-link-buttons";
import { UnlinkDialog } from "./unlink-dialog";
import { UnpublishedMessages } from "./unpublished-messages";
import { VisibilityTable } from "./visibility-table";

type VisibilityTableProps = Parameters<typeof VisibilityTable>[0];

const points = createLinkedClient({ clientId: "points", name: "Points" });
const profile: Destination = { kind: "profile" };
const pointsColumn: Destination = { kind: "client", client: points };

const linkVerification: LinkedVerification = {
  id: "evf_link",
  method: "bidirectional_link",
  verifiedAt: "2026-09-12T14:05:00Z",
  evidence: "https://github.com/alice",
  identifiers: [{ id: "eid_1", type: "url", provider: null, value: "https://github.com/alice", isActive: true }],
};
const oauthVerification: LinkedVerification = {
  id: "evf_oauth",
  method: "oauth",
  verifiedAt: "2026-09-12T14:03:00Z",
  evidence: null,
  identifiers: [{ id: "eid_2", type: "provider_account", provider: "github", value: "1843221", isActive: true }],
};
const githubAccount = createLinkedAccount({
  id: "eac_github",
  service: "github",
  identifiers: [
    { id: "eid_1", type: "url", provider: null, value: "https://github.com/alice", isActive: true },
    { id: "eid_3", type: "provider_username", provider: "github", value: "alice", isActive: true },
  ],
  verifications: [oauthVerification, linkVerification],
});
const qiitaAccount = createLinkedAccount({
  id: "eac_qiita",
  service: "qiita",
  verificationStatus: "unverified",
  identifiers: [{ id: "eid_4", type: "url", provider: null, value: "https://qiita.com/hanako", isActive: false }],
  primaryUrl: "https://qiita.com/hanako",
  latestAttempt: { checkedAt: "2026-09-25T16:20:00Z", result: "not_verified", failureCode: "LINK_NOT_FOUND" },
});

/**
 * 表を描画する。
 * 操作の呼出しを確かめるため、ハンドラーをモックにして返す。
 */
function renderTable({
  accounts = [githubAccount, qiitaAccount],
  edits = emptyVisibilityEdits,
  isSelectionDisabled = false,
}: {
  accounts?: ReturnType<typeof createLinkedAccount>[];
  edits?: typeof emptyVisibilityEdits;
  isSelectionDisabled?: boolean;
} = {}) {
  const handlers = {
    onSelect: vi.fn<VisibilityTableProps["onSelect"]>(),
    onRequestUnlink: vi.fn<VisibilityTableProps["onRequestUnlink"]>(),
    onReverify: vi.fn<VisibilityTableProps["onReverify"]>(),
  };
  renderWithProviders(
    <VisibilityTable
      table={buildVisibilityTable(createAccountLinks({ accounts, clients: [points] }), edits)}
      reverifyingAccountId={null}
      reverifyFailure={null}
      isSelectionDisabled={isSelectionDisabled}
      {...handlers}
    />,
  );
  return handlers;
}

describe("VisibilityTable", () => {
  it("プロフィールと連携先を列にし、保存済みの状態から「公開中」「非公開」を示す", async () => {
    renderTable({ accounts: [createLinkedAccount({ isPublic: true, visibility: { points: false } })] });
    const table = await screen.findByRole("table");

    expect(within(table).getByRole("columnheader", { name: /プロフィール.*公開中/ })).toBeDefined();
    expect(within(table).getByRole("columnheader", { name: /Points.*非公開/ })).toBeDefined();
  });

  it("行を「サービス名：識別子」と成功した方法のチップで示し、未検証の行は「未検証」とする", async () => {
    renderTable();
    const table = await screen.findByRole("table");

    const githubRow = within(table).getByRole("rowheader", { name: /GitHub：alice/ });
    expect(within(githubRow).getByText("OAuth")).toBeDefined();
    expect(within(githubRow).getByText("双方向リンク")).toBeDefined();
    expect(within(within(table).getByRole("rowheader", { name: /Qiita：qiita\.com\/hanako/ })).getByText("未検証")).toBeDefined();
  });

  it("セル・行・列・全体のチェックで、対象の公開先と行をまとめて選ぶ（一括は未検証の行も含む）", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderTable();

    await user.click(await screen.findByRole("checkbox", { name: "GitHub：aliceをPointsに公開" }));
    await user.click(screen.getByRole("checkbox", { name: "GitHub：aliceをすべての公開先に公開" }));
    await user.click(screen.getByRole("checkbox", { name: "すべての行を一括でPointsに公開" }));
    await user.click(screen.getByRole("checkbox", { name: "すべての行をすべての公開先に一括で公開" }));

    expect(onSelect.mock.calls).toEqual([
      [[pointsColumn], ["eac_github"], true],
      [[profile, pointsColumn], ["eac_github"], true],
      [[pointsColumn], ["eac_github", "eac_qiita"], true],
      [[profile, pointsColumn], ["eac_github", "eac_qiita"], true],
    ]);
  });

  it("保存中はセル・行・列・全体のチェックをすべて無効にする", async () => {
    renderTable({ isSelectionDisabled: true });

    const checkboxes = (await screen.findAllByRole("checkbox")) as HTMLInputElement[];
    expect(checkboxes).toHaveLength(9);
    expect(checkboxes.every((checkbox) => checkbox.disabled)).toBe(true);
  });

  it("一括のチェックは一部だけ選ばれていれば中間表示にする", async () => {
    renderTable({ edits: setSelection(emptyVisibilityEdits, [pointsColumn], ["eac_github"], true) });

    const bulk = (await screen.findByRole("checkbox", { name: "すべての行を一括でPointsに公開" })) as HTMLInputElement;
    expect(bulk.indeterminate).toBe(true);
  });

  it("保存済みから変更したセルを強調する", async () => {
    renderTable({ edits: setSelection(emptyVisibilityEdits, [pointsColumn], ["eac_github"], true) });

    const changed = await screen.findByRole("checkbox", { name: "GitHub：aliceをPointsに公開" });
    const unchanged = screen.getByRole("checkbox", { name: "GitHub：aliceをプロフィールに公開" });
    expect(changed.closest("td")?.className).toContain("bg-highlight");
    expect(unchanged.closest("td")?.className).not.toContain("bg-highlight");
  });

  it("証明済みの行の「詳細」は、成功した方法ごとの証明日時・証拠・識別子と解除の操作を示す", async () => {
    const user = userEvent.setup();
    const { onRequestUnlink } = renderTable();
    const githubRow = await screen.findByRole("rowheader", { name: /GitHub：alice/ });

    await user.click(within(githubRow).getByRole("button", { name: "詳細" }));
    const blocks = screen.getAllByRole("group", { name: /の証明$/ });

    expect(blocks).toHaveLength(2);
    const linkBlock = blocks[1] as HTMLElement;
    expect(within(linkBlock).getByText("成功")).toBeDefined();
    expect(within(linkBlock).getByText("2026/09/12 14:05 (UTC)")).toBeDefined();
    expect(within(linkBlock).getByText("証拠を確認したページ")).toBeDefined();
    expect(within(blocks[0] as HTMLElement).getByText("固有ID 1843221")).toBeDefined();
    await user.click(within(linkBlock).getByRole("button", { name: "この証明を解除" }));
    await user.click(screen.getByRole("button", { name: "すべての連携解除" }));

    expect(onRequestUnlink.mock.calls).toEqual([
      [{ kind: "verification", account: githubAccount, verification: linkVerification }],
      [{ kind: "account", account: githubAccount }],
    ]);
  });

  it("未検証の行の「詳細」は、直近の検証結果・案内・「再検証」を示す", async () => {
    const user = userEvent.setup();
    const { onReverify } = renderTable();
    const qiitaRow = await screen.findByRole("rowheader", { name: /Qiita/ });

    await user.click(within(qiitaRow).getByRole("button", { name: "詳細" }));
    await user.click(screen.getByRole("button", { name: "再検証" }));

    expect(screen.getByText("直近の検証 2026/09/25 16:20 (UTC)：証拠を確認できませんでした")).toBeDefined();
    expect(screen.getByText(/公開プロフィールURLが見つかりませんでした/)).toBeDefined();
    expect(onReverify).toHaveBeenCalledWith(qiitaAccount);
  });

  it("試行もURLも無い未検証の行は、未検証であることと「ログインで証明」への案内を示し、「再検証」を置かない", async () => {
    const user = userEvent.setup();
    renderTable({
      accounts: [
        createLinkedAccount({
          service: "google",
          email: "hanako@example.com",
          verificationStatus: "unverified",
          identifiers: [{ id: "eid_1", type: "provider_account", provider: "google", value: "1", isActive: false }],
          primaryUrl: null,
        }),
      ],
    });

    await user.click(await screen.findByRole("button", { name: "詳細" }));

    expect(screen.getByText("まだ検証していません。")).toBeDefined();
    expect(screen.getByText(/「ログインで証明」/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "再検証" })).toBeNull();
  });

  it("外部アカウントが無い場合は追加の案内を表示する", async () => {
    renderTable({ accounts: [] });

    expect(await screen.findByText(/連携済みの外部アカウントはありません/)).toBeDefined();
  });

  it("外部の識別子に含まれるHTMLを文字列として表示する", async () => {
    const { container } = renderWithProviders(
      <VisibilityTable
        table={buildVisibilityTable(
          createAccountLinks({
            accounts: [
              createLinkedAccount({
                service: "github",
                identifiers: [
                  { id: "eid_1", type: "provider_username", provider: "github", value: "<img src=x onerror=alert(1)>", isActive: true },
                ],
              }),
            ],
          }),
          emptyVisibilityEdits,
        )}
        reverifyingAccountId={null}
        reverifyFailure={null}
        isSelectionDisabled={false}
        onSelect={vi.fn<VisibilityTableProps["onSelect"]>()}
        onRequestUnlink={vi.fn<VisibilityTableProps["onRequestUnlink"]>()}
        onReverify={vi.fn<VisibilityTableProps["onReverify"]>()}
      />,
    );

    expect(await screen.findByRole("rowheader", { name: /GitHub：<img src=x onerror=alert\(1\)>/ })).toBeDefined();
    expect(container.querySelector("img[src=x]")).toBeNull();
  });
});

describe("UnpublishedMessages", () => {
  it("保存済みの状態で証明済みの選択が0件の公開先ごとに、情報を提供しないことを示す", async () => {
    const table = buildVisibilityTable(
      createAccountLinks({
        accounts: [createLinkedAccount({ isPublic: false, visibility: { points: false } })],
        clients: [points, createLinkedClient({ clientId: "kotoba", name: "Kotoba" })],
      }),
      emptyVisibilityEdits,
    );
    const published = { ...table, columns: table.columns.map((column, index) => ({ ...column, isPublished: index === 2 })) };

    renderWithProviders(<UnpublishedMessages columns={published.columns} />);

    expect(
      await screen.findByText("プロフィール：公開する外部アカウントが選択されていないため、公開プロフィールは表示されません。"),
    ).toBeDefined();
    expect(screen.getByText("Points：公開する外部アカウントが選択されていないため、Points に情報を提供しません。")).toBeDefined();
    expect(screen.queryByText(/Kotoba：/)).toBeNull();
  });
});

describe("UnlinkDialog", () => {
  const dialogProps = {
    isSubmitting: false,
    error: null,
    onConfirm: vi.fn<() => void>(),
    onCancel: vi.fn<() => void>(),
  };

  it("DNS TXTの証明の解除は、押した行だけが対象であることを示す", async () => {
    const dns: LinkedVerification = { ...linkVerification, id: "evf_dns", method: "dns_txt", evidence: "_accounts.hanako.dev" };
    const account = createLinkedAccount({ verifications: [oauthVerification, dns] });

    renderWithProviders(<UnlinkDialog {...dialogProps} target={{ kind: "verification", account, verification: dns }} />);

    expect(await screen.findByText("この証明を解除しますか？")).toBeDefined();
    expect(screen.getByText(/同じホストの他の行の証明は残ります。/)).toBeDefined();
    expect(screen.queryByText(/未検証になります/)).toBeNull();
  });

  it("最後の証明の解除は、行と公開設定が残り未検証になることを示す", async () => {
    const account = createLinkedAccount({ verifications: [linkVerification] });

    renderWithProviders(<UnlinkDialog {...dialogProps} target={{ kind: "verification", account, verification: linkVerification }} />);

    expect(await screen.findByText(/「双方向リンク」による証明を終了します。行と公開設定は残り、未検証になります。/)).toBeDefined();
  });

  it("すべての連携解除は、行の識別子・証明・公開設定がすべて終わることを示す", async () => {
    renderWithProviders(<UnlinkDialog {...dialogProps} target={{ kind: "account", account: githubAccount }} />);

    expect(await screen.findByText("外部アカウントの連携を解除しますか？")).toBeDefined();
    expect(screen.getByText(/GitHub：aliceの識別子・証明方法・公開設定をすべて終了します。/)).toBeDefined();
  });
});

describe("ProfileUrlPanel", () => {
  it("公開プロフィールURLを、新しいタブで開く外部リンクとして表示し、コピーを置く", async () => {
    renderWithProviders(<ProfileUrlPanel profileUrl="https://accounts.example/profiles/ausr_1" />);

    const link = await screen.findByRole("link", { name: /https:\/\/accounts\.example\/profiles\/ausr_1/ });
    expect(link.getAttribute("href")).toBe("https://accounts.example/profiles/ausr_1");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener");
    expect(screen.getByRole("button", { name: "コピー" })).toBeDefined();
  });
});

describe("ProviderLinkButtons", () => {
  it("Google・GitHub・ORCIDの連携ボタンを置く", async () => {
    const onLink = vi.fn<(provider: "google" | "github" | "orcid") => void>();
    renderWithProviders(<ProviderLinkButtons pendingProvider={null} hasStartFailed={false} callbackError={null} onLink={onLink} />);

    await userEvent.click(await screen.findByRole("button", { name: "ORCIDを連携" }));

    expect(screen.getByRole("button", { name: "Googleを連携" })).toBeDefined();
    expect(screen.getByRole("button", { name: "GitHubを連携" })).toBeDefined();
    expect(onLink).toHaveBeenCalledWith("orcid");
  });
});

describe("ExternalUrlForm", () => {
  const formProps = {
    url: "",
    onUrlChange: vi.fn<(url: string) => void>(),
    validationError: null,
    submittingMode: null,
    onSubmit: vi.fn<(mode: "verify" | "unverified") => void>(),
    outcome: null,
    error: null,
    urlInputErrorCode: null,
    urlCount: 4,
  };

  it("手順・件数・「検証する」「未検証で保存」・困った場合の案内を置く", async () => {
    renderWithProviders(<ExternalUrlForm {...formProps} />, { path: "/ausr_1/account-links" });

    expect(await screen.findByText("「公開プロフィールURL」")).toBeDefined();
    expect(screen.getByText("登録済みのURL: 4 / 150件")).toBeDefined();
    expect(screen.getByRole("button", { name: "検証する" })).toBeDefined();
    expect(screen.getByRole("button", { name: "未検証で保存" })).toBeDefined();
    expect(screen.getByRole("link", { name: "困った場合はこちら" }).getAttribute("href")).toBe("/ausr_1/help#url-verification");
  });

  it("未登録URLの検証が保留でも、失敗と同じ要約で「未検証で保存」を案内し、方法ごとの結果と案内を示す", async () => {
    renderWithProviders(
      <ExternalUrlForm
        {...formProps}
        outcome={{
          mode: "verify",
          result: {
            externalAccountId: null,
            status: "unverified",
            link: { result: "indeterminate", failureCode: "MULTIPLE_ACCOUNTS_PROFILES", evidenceUrl: null },
            dns: { result: "indeterminate", failureCode: "DNS_TIMEOUT" },
          },
        }}
      />,
    );

    expect(
      await screen.findByText(
        "証明が成立しなかったため、URLは保存していません。未検証のまま登録する場合は「未検証で保存」を押してください。",
      ),
    ).toBeDefined();
    expect(screen.getByText("双方向リンク: 判断できませんでした")).toBeDefined();
    expect(screen.getByText(/別のFreeism Accountsユーザーの公開プロフィールURL/)).toBeDefined();
    expect(screen.getByText("DNS TXT: 判断できませんでした")).toBeDefined();
  });

  it("成功した場合は、証拠を確認したページを示す", async () => {
    renderWithProviders(
      <ExternalUrlForm
        {...formProps}
        outcome={{
          mode: "verify",
          result: {
            externalAccountId: "eac_1",
            status: "verified",
            link: { result: "verified", failureCode: null, evidenceUrl: "https://github.com/alice" },
            dns: null,
          },
        }}
      />,
    );

    expect(await screen.findByText("所有権を証明しました。")).toBeDefined();
    expect(screen.getByText("双方向リンク: 成功")).toBeDefined();
    expect(screen.getByText("https://github.com/alice")).toBeDefined();
  });

  it("再検証で今回の試行が成立しなくても、既存の証明が有効なら維持されていることを示す", async () => {
    renderWithProviders(
      <ExternalUrlForm
        {...formProps}
        outcome={{
          mode: "verify",
          result: {
            externalAccountId: "eac_1",
            status: "verified",
            link: { result: "not_verified", failureCode: "LINK_NOT_FOUND", evidenceUrl: null },
            dns: { result: "not_verified", failureCode: "TXT_NOT_FOUND" },
          },
        }}
      />,
    );

    expect(await screen.findByText(/以前に成立した証明は引き続き有効です/)).toBeDefined();
    expect(screen.queryByText("所有権を証明しました。")).toBeNull();
  });

  it("バックエンドが返したURLの不備を、読み上げられる理由で示す", async () => {
    renderWithProviders(<ExternalUrlForm {...formProps} error={new Error("400")} urlInputErrorCode="HOST_NOT_ALLOWED" />);

    expect((await screen.findByRole("alert")).textContent).toContain("IPアドレスやローカル");
  });

  it("URLの形式の不備は、記号で囲まずに「https://から始まる」と示す", async () => {
    renderWithProviders(<ExternalUrlForm {...formProps} error={new Error("400")} urlInputErrorCode="INVALID_URL" />);

    const alertText = (await screen.findByRole("alert")).textContent;
    expect(alertText).toContain("https://から始まる完全なURL");
    expect(alertText).not.toContain("`");
  });

  it("DNS TXTが見つからない場合の案内は、記号で囲まずにレコード名を示す", async () => {
    renderWithProviders(
      <ExternalUrlForm
        {...formProps}
        outcome={{
          mode: "verify",
          result: {
            externalAccountId: null,
            status: "unverified",
            link: { result: "not_verified", failureCode: "LINK_NOT_FOUND", evidenceUrl: null },
            dns: { result: "not_verified", failureCode: "TXT_NOT_FOUND" },
          },
        }}
      />,
    );

    const statusText = (await screen.findByRole("status")).textContent;
    expect(statusText).toContain("_accounts.{ホスト名}に公開プロフィールURLのTXTレコードが見つかりませんでした。");
    expect(statusText).not.toContain("`");
  });

  it("スキームの無い入力もブラウザー標準の型検査で止めず、アプリの検査に任せる", async () => {
    renderWithProviders(<ExternalUrlForm {...formProps} url="github.com/alice" />);

    const input = (await screen.findByRole("textbox", { name: "外部ページのURL" })) as HTMLInputElement;

    expect(input.inputMode).toBe("url");
    expect(input.validity.typeMismatch).toBe(false);
  });

  it("URLの上限に達している場合は案内を表示し、判定はバックエンドに任せる", async () => {
    renderWithProviders(<ExternalUrlForm {...formProps} urlCount={150} />);

    expect((await screen.findByRole("button", { name: "検証する" })).hasAttribute("disabled")).toBe(false);
    expect(screen.getByText(/上限に達しています/)).toBeDefined();
  });
});
