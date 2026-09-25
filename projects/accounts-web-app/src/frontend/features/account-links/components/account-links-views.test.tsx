// @vitest-environment happy-dom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../../test/render-with-providers";
import { createAccountLinks, createLinkedAccount, createLinkedClient } from "../lib/account-links-fixtures";
import { buildVisibilityTable, emptyVisibilityEdits, setClientConsent } from "../lib/visibility-draft";
import { ConsentPanel } from "./consent-panel";
import { ExternalUrlForm } from "./external-url-form";
import { VisibilityTable } from "./visibility-table";

type VisibilityTableProps = Parameters<typeof VisibilityTable>[0];

const tableHandlers = {
  saveState: { status: "idle" } as const,
  onAccountPublicChange: vi.fn<VisibilityTableProps["onAccountPublicChange"]>(),
  onClientConsentChange: vi.fn<VisibilityTableProps["onClientConsentChange"]>(),
  onClientVisibilityChange: vi.fn<VisibilityTableProps["onClientVisibilityChange"]>(),
  onAccountVisibilityForAllClientsChange: vi.fn<VisibilityTableProps["onAccountVisibilityForAllClientsChange"]>(),
  onSave: vi.fn<VisibilityTableProps["onSave"]>(),
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
    expect(screen.getByRole("button", { name: "公開設定を保存" }).hasAttribute("disabled")).toBe(true);
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

  it("バックエンドが返したURLの不備を、読み上げられる理由で示す", async () => {
    renderWithProviders(<ExternalUrlForm {...formProps} error={new Error("400")} urlInputErrorCode="HOST_NOT_ALLOWED" />);

    expect((await screen.findByRole("alert")).textContent).toContain("IPアドレスやローカル");
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
