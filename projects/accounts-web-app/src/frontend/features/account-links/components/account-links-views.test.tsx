// @vitest-environment happy-dom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../../test/render-with-providers";
import type { VisibilitySaveState } from "../hooks/use-account-links";
import { createAccountLinks, createLinkedAccount, createLinkedClient } from "../lib/account-links-fixtures";
import { buildVisibilityTable, emptyVisibilityEdits, setClientConsent } from "../lib/visibility-draft";
import { ConsentPanel } from "./consent-panel";
import { ExternalUrlForm } from "./external-url-form";
import { ProfileUrlPanel } from "./profile-url-panel";
import { VisibilityTable } from "./visibility-table";

type VisibilityTableProps = Parameters<typeof VisibilityTable>[0];

const tableHandlers = {
  saveState: { status: "idle" } as const,
  onAccountPublicChange: vi.fn<VisibilityTableProps["onAccountPublicChange"]>(),
  onClientConsentChange: vi.fn<VisibilityTableProps["onClientConsentChange"]>(),
  onClientVisibilityChange: vi.fn<VisibilityTableProps["onClientVisibilityChange"]>(),
  onAccountVisibilityForAllClientsChange: vi.fn<VisibilityTableProps["onAccountVisibilityForAllClientsChange"]>(),
  onSave: vi.fn<VisibilityTableProps["onSave"]>(),
  onDiscard: vi.fn<VisibilityTableProps["onDiscard"]>(),
  onRequestUnlinkAccount: vi.fn<VisibilityTableProps["onRequestUnlinkAccount"]>(),
  onRequestUnlinkOAuth: vi.fn<VisibilityTableProps["onRequestUnlinkOAuth"]>(),
};

describe("VisibilityTable", () => {
  it("同意ONで証明済みの選択が無い連携先を示し、保存ボタンを非活性にする", async () => {
    const links = createAccountLinks({ clients: [createLinkedClient({ name: "Points" })] });

    renderWithProviders(
      <VisibilityTable table={buildVisibilityTable(links, setClientConsent(emptyVisibilityEdits, "points", true))} {...tableHandlers} />,
    );

    expect((await screen.findAllByText(/Points: 同意をONにした連携先には/)).length).toBeGreaterThan(0);
    for (const button of screen.getAllByRole("button", { name: "公開設定を保存" })) {
      expect(button.hasAttribute("disabled")).toBe(true);
    }
  });

  it("表の上と下に保存・破棄の操作を置き、変更が無い間は押せない", async () => {
    const links = createAccountLinks({ clients: [createLinkedClient({ name: "Points" })] });

    renderWithProviders(<VisibilityTable table={buildVisibilityTable(links, emptyVisibilityEdits)} {...tableHandlers} />);
    const saveButtons = await screen.findAllByRole("button", { name: "公開設定を保存" });
    const discardButtons = screen.getAllByRole("button", { name: "編集内容を破棄" });

    expect(saveButtons).toHaveLength(2);
    expect(discardButtons).toHaveLength(2);
    expect(screen.queryByText("未保存の変更があります")).toBeNull();
    for (const button of [...saveButtons, ...discardButtons]) {
      expect(button.hasAttribute("disabled")).toBe(true);
    }
  });

  it("未保存の変更がある場合は、保存・破棄できることと未保存であることを示す", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<VisibilityTableProps["onSave"]>();
    const onDiscard = vi.fn<VisibilityTableProps["onDiscard"]>();
    const links = createAccountLinks({ clients: [createLinkedClient({ name: "Points", consented: true })] });

    renderWithProviders(
      <VisibilityTable
        table={buildVisibilityTable(links, setClientConsent(emptyVisibilityEdits, "points", false))}
        {...tableHandlers}
        onSave={onSave}
        onDiscard={onDiscard}
      />,
    );
    const [topSaveButton, bottomSaveButton] = await screen.findAllByRole("button", { name: "公開設定を保存" });
    await user.click(topSaveButton as HTMLElement);
    await user.click(bottomSaveButton as HTMLElement);
    await user.click(screen.getAllByRole("button", { name: "編集内容を破棄" })[1] as HTMLElement);

    expect(screen.getAllByText("未保存の変更があります")).toHaveLength(2);
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("保存の結果は、押した保存ボタンの近くに1回だけ示す", async () => {
    const user = userEvent.setup();
    const links = createAccountLinks({ clients: [createLinkedClient({ name: "Points", consented: true })] });
    const table = buildVisibilityTable(links, setClientConsent(emptyVisibilityEdits, "points", false));

    /**
     * 保存ボタンを押すと保存済みの状態にする表。
     */
    function SavingTable() {
      const [saveState, setSaveState] = useState<VisibilitySaveState>({ status: "idle" });
      return <VisibilityTable table={table} {...tableHandlers} saveState={saveState} onSave={() => setSaveState({ status: "saved" })} />;
    }
    renderWithProviders(<SavingTable />);

    const bottomSaveButton = (await screen.findAllByRole("button", { name: "公開設定を保存" }))[1] as HTMLElement;
    await user.click(bottomSaveButton);

    const notices = await screen.findAllByText("公開設定を保存しました。");
    expect(notices).toHaveLength(1);
    expect(bottomSaveButton.compareDocumentPosition(notices[0] as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("table").compareDocumentPosition(notices[0] as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("一般公開と連携先への同意を、表の列と列の見出しに置く", async () => {
    const links = createAccountLinks({
      accounts: [createLinkedAccount({ id: "eac_1", displayName: "Alice" })],
      clients: [createLinkedClient({ clientId: "points", name: "Points" })],
    });

    renderWithProviders(<VisibilityTable table={buildVisibilityTable(links, emptyVisibilityEdits)} {...tableHandlers} />);
    const table = await screen.findByRole("table");

    expect(within(table).getByRole("columnheader", { name: /一般公開/ })).toBeDefined();
    expect(within(table).getByRole("checkbox", { name: "GitHub: Aliceを一般公開" })).toBeDefined();
    expect(within(table).getByRole("switch", { name: "Pointsへの提供に同意する" })).toBeDefined();
  });

  it("行と連携先の組ごとに、読み上げ可能な名前のチェックボックスを置く", async () => {
    const user = userEvent.setup();
    const onClientVisibilityChange = vi.fn<VisibilityTableProps["onClientVisibilityChange"]>();
    const links = createAccountLinks({
      accounts: [createLinkedAccount({ id: "eac_1", displayName: "Alice" })],
      clients: [createLinkedClient({ clientId: "points", name: "Points" })],
    });

    renderWithProviders(
      <VisibilityTable
        table={buildVisibilityTable(links, emptyVisibilityEdits)}
        {...tableHandlers}
        onClientVisibilityChange={onClientVisibilityChange}
      />,
    );
    await user.click(await screen.findByRole("checkbox", { name: "GitHub: AliceをPointsに公開" }));

    expect(onClientVisibilityChange).toHaveBeenCalledWith("points", ["eac_1"], true);
  });

  it("OAuthの証明を持つ行にだけ「OAuthの認証連携だけ解除する」を置く", async () => {
    const links = createAccountLinks({
      accounts: [
        createLinkedAccount({
          id: "eac_oauth",
          verifications: [
            {
              id: "evf_1",
              method: "oauth",
              authAccountId: "acc_1",
              evidenceUrl: null,
              verifiedAt: "2026-09-01T00:00:00Z",
              checkedAt: "2026-09-01T00:00:00Z",
              result: "verified",
              failureCode: null,
              identifierIds: ["eid_1"],
            },
          ],
        }),
        createLinkedAccount({ id: "eac_web", displayName: "Blog", verifications: [] }),
      ],
    });

    renderWithProviders(<VisibilityTable table={buildVisibilityTable(links, emptyVisibilityEdits)} {...tableHandlers} />);

    expect(await screen.findAllByRole("button", { name: "連携解除" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "OAuthの認証連携だけ解除する" })).toHaveLength(1);
    expect(screen.getByText("OAuth: 成功")).toBeDefined();
  });

  it("外部アカウントが無い場合は追加の案内を表示する", async () => {
    renderWithProviders(
      <VisibilityTable table={buildVisibilityTable(createAccountLinks({ accounts: [] }), emptyVisibilityEdits)} {...tableHandlers} />,
    );

    expect(await screen.findByText(/連携済みの外部アカウントはありません/)).toBeDefined();
  });

  it("外部の表示名に含まれるHTMLを文字列として表示する", async () => {
    const links = createAccountLinks({ accounts: [createLinkedAccount({ displayName: "<img src=x onerror=alert(1)>" })] });

    const { container } = renderWithProviders(
      <VisibilityTable table={buildVisibilityTable(links, emptyVisibilityEdits)} {...tableHandlers} />,
    );

    expect(await screen.findByText("GitHub: <img src=x onerror=alert(1)>")).toBeDefined();
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("ProfileUrlPanel", () => {
  it("公開プロフィールURLを、新しいタブで開く外部リンクとして表示する", async () => {
    renderWithProviders(<ProfileUrlPanel profileUrl="https://accounts.example/profiles/ausr_1" />);

    const link = await screen.findByRole("link", { name: "https://accounts.example/profiles/ausr_1" });
    expect(link.getAttribute("href")).toBe("https://accounts.example/profiles/ausr_1");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener");
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
    urlCount: 0,
  };

  it("検証の結果を方法ごとに示し、failure_codeから次の操作を案内する", async () => {
    renderWithProviders(
      <ExternalUrlForm
        {...formProps}
        outcome={{
          mode: "verify",
          result: {
            externalAccountId: "eac_1",
            status: "unverified",
            link: { result: "indeterminate", failureCode: "ACCESS_RESTRICTED", evidenceUrl: null },
            dns: { result: "not_verified", failureCode: "TXT_NOT_FOUND" },
          },
        }}
      />,
    );

    expect(await screen.findByText("公開ページのリンク確認: 判断できませんでした")).toBeDefined();
    expect(screen.getByText(/ページへのアクセスが制限されていました/)).toBeDefined();
    expect(screen.getByText("DNS TXT: 証拠を確認できませんでした")).toBeDefined();
    expect(screen.getByText(/時間をおいて再検証してください/)).toBeDefined();
  });

  it("未登録URLの検証が不成立で登録されなかった場合は、「未検証で保存」を案内する", async () => {
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

    expect(await screen.findByText(/URLは保存していません。.*「未検証で保存」/)).toBeDefined();
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

  it("スキームの無い入力もブラウザー標準の型検査で止めず、アプリの検査に任せる", async () => {
    renderWithProviders(<ExternalUrlForm {...formProps} url="github.com/alice" />);

    const input = (await screen.findByRole("textbox", { name: "外部ページのURL" })) as HTMLInputElement;

    expect(input.inputMode).toBe("url");
    expect(input.validity.typeMismatch).toBe(false);
  });

  it("URLの上限に達している場合は案内を表示し、判定はバックエンドに任せる", async () => {
    renderWithProviders(<ExternalUrlForm {...formProps} urlCount={150} />);

    expect((await screen.findByRole("button", { name: "保存して検証する" })).hasAttribute("disabled")).toBe(false);
    expect(screen.getByText(/上限に達しています/)).toBeDefined();
  });
});

describe("ConsentPanel", () => {
  const panelProps = {
    request: { clientId: "points", redirectHost: "points.example", expiresAt: null },
    client: createLinkedClient({ name: "Points", uri: "https://points.example/" }),
    isListReady: true,
    activeUser: { accountsUserId: "ausr_1", displayName: "Alice", profileUrl: "https://accounts.example/profiles/ausr_1" },
    isExpired: false,
    hasFailed: false,
    isSubmitting: false,
    canAccept: true,
    onAccept: vi.fn<() => void>(),
    onDeny: vi.fn<() => void>(),
  };

  it("連携先・戻り先のhost・アクティブユーザー・利用目的を表示する", async () => {
    renderWithProviders(<ConsentPanel {...panelProps} />);

    expect(await screen.findByText("Pointsが情報の提供を求めています")).toBeDefined();
    expect(screen.getByText("points.example")).toBeDefined();
    expect(screen.getByText("Alice (ausr_1)")).toBeDefined();
    expect(screen.getByText(/公開表示し、貢献者の照合に使うことがあります/)).toBeDefined();
    expect(screen.getByText("この画面は表示から10分で失効します。")).toBeDefined();
  });

  it("失効した場合はやり直しを案内し、2つの操作を非活性にする", async () => {
    renderWithProviders(<ConsentPanel {...panelProps} isExpired />);

    expect((await screen.findByRole("alert")).textContent).toContain("元のサービスから連携を最初からやり直してください");
    expect(screen.getByRole("button", { name: "同意して戻る" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "同意しない" }).hasAttribute("disabled")).toBe(true);
  });

  it("今回の連携先が一覧に無い場合は、やり直しを案内して「同意しない」だけを残す", async () => {
    renderWithProviders(<ConsentPanel {...panelProps} client={null} />);

    expect((await screen.findByRole("alert")).textContent).toContain("連携先のサービスが見つかりません");
    expect(screen.getByRole("button", { name: "同意して戻る" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "同意しない" }).hasAttribute("disabled")).toBe(false);
  });

  it("一覧の取得前は、連携先が無いことや選択が必要なことを表示しない", async () => {
    renderWithProviders(<ConsentPanel {...panelProps} client={null} isListReady={false} canAccept={false} />);

    await screen.findByText("この画面は表示から10分で失効します。");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/証明済みの外部アカウントを1件以上選択してください/)).toBeNull();
  });

  it("証明済みの選択が無い場合は「同意して戻る」だけを非活性にする", async () => {
    renderWithProviders(<ConsentPanel {...panelProps} canAccept={false} />);

    expect((await screen.findByRole("button", { name: "同意して戻る" })).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "同意しない" }).hasAttribute("disabled")).toBe(false);
  });
});
