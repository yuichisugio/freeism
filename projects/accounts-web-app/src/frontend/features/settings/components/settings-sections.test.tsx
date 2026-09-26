// @vitest-environment happy-dom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BffError } from "../../../lib/api-client";
import { renderWithProviders } from "../../../test/render-with-providers";
import type { AccountDeletion } from "../hooks/use-account-deletion";
import type { BackupExport } from "../hooks/use-backup-export";
import type { BackupRestore } from "../hooks/use-backup-restore";
import type { DisplayNameForm } from "../hooks/use-display-name-form";
import { AccountDeletionSection } from "./account-deletion-section";
import { BackupExportSection } from "./backup-export-section";
import { BackupRestoreSection } from "./backup-restore-section";
import { DisplayNameSection } from "./display-name-section";
import { LanguageSection } from "./language-section";

// --------------------------------------------------
// フックの状態
// --------------------------------------------------

function displayNameForm(overrides: Partial<DisplayNameForm> = {}): DisplayNameForm {
  return {
    me: { accountsUserId: "user-1", displayName: "仮ユーザー", profileUrl: "https://accounts.example/profiles/user-1" },
    loadError: null,
    isLoading: false,
    reload: vi.fn<() => void>(),
    displayName: "仮ユーザー",
    issue: null,
    isDirty: false,
    canSave: false,
    isSaving: false,
    isSaved: false,
    saveError: null,
    changeDisplayName: vi.fn<(value: string) => void>(),
    save: vi.fn<() => Promise<void>>(),
    ...overrides,
  };
}

function backupExport(overrides: Partial<BackupExport> = {}): BackupExport {
  return {
    summary: { externalAccountCount: 3, unverifiedAccountCount: 1, clientConsentCount: 2, includesPrivateData: true },
    summaryError: null,
    isSummaryLoading: false,
    reloadSummary: vi.fn<() => void>(),
    isExporting: false,
    isExported: false,
    exportError: null,
    exportBackup: vi.fn<() => Promise<void>>(),
    ...overrides,
  };
}

function backupRestore(overrides: Partial<BackupRestore> = {}): BackupRestore {
  return {
    file: null,
    selectFile: vi.fn<(file: File | null) => void>(),
    canRestore: false,
    isRestoring: false,
    result: null,
    issues: [],
    restoreError: null,
    restore: vi.fn<() => Promise<void>>(),
    ...overrides,
  };
}

function accountDeletion(overrides: Partial<AccountDeletion> = {}): AccountDeletion {
  return {
    clients: [],
    clientsError: null,
    isClientsLoading: false,
    reloadClients: vi.fn<() => void>(),
    isConfirmed: false,
    changeConfirmed: vi.fn<(isConfirmed: boolean) => void>(),
    canDelete: false,
    isDeleting: false,
    deleteError: null,
    deleteAccount: vi.fn<() => Promise<void>>(),
    ...overrides,
  };
}

/**
 * ボタンが押せない状態かを返す。
 */
async function isButtonDisabled(name: string): Promise<boolean> {
  return (await screen.findByRole<HTMLButtonElement>("button", { name })).disabled;
}

// --------------------------------------------------
// 表示言語
// --------------------------------------------------

describe("LanguageSection", () => {
  it("現在の表示言語を選択済みにし、選んだ言語で画面を表示してこのブラウザーに保存する", async () => {
    renderWithProviders(<LanguageSection />);

    expect((await screen.findByRole<HTMLInputElement>("radio", { name: "日本語" })).checked).toBe(true);
    await userEvent.click(screen.getByRole("radio", { name: "English" }));

    expect(await screen.findByText("Display language")).toBeDefined();
    expect(screen.getByRole<HTMLInputElement>("radio", { name: "English" }).checked).toBe(true);
    expect(window.localStorage.getItem("accounts.language")).toBe("en");
  });
});

// --------------------------------------------------
// 表示名
// --------------------------------------------------

describe("DisplayNameSection", () => {
  it("未変更の間は「保存」ボタンを押せない", async () => {
    renderWithProviders(<DisplayNameSection form={displayNameForm()} />);

    expect(await isButtonDisabled("保存")).toBe(true);
    expect(screen.getByText("AccountsユーザーID: user-1")).toBeDefined();
  });

  it("入力不備は理由をテキストで示し、「保存」ボタンを押せない", async () => {
    renderWithProviders(
      <DisplayNameSection form={displayNameForm({ displayName: "あ".repeat(51), issue: "tooLong", isDirty: true })} />,
    );

    expect(await screen.findByText("表示名は50文字以内で入力してください。")).toBeDefined();
    expect(await isButtonDisabled("保存")).toBe(true);
  });

  it("保存できる状態で「保存」ボタンを押すと保存する", async () => {
    const save = vi.fn<() => Promise<void>>();
    renderWithProviders(<DisplayNameSection form={displayNameForm({ isDirty: true, canSave: true, save })} />);

    await userEvent.click(await screen.findByRole("button", { name: "保存" }));

    expect(save).toHaveBeenCalledOnce();
  });

  it("保存の成功をstatus、失敗をalertで示す", async () => {
    renderWithProviders(
      <DisplayNameSection form={displayNameForm({ isSaved: true, saveError: new BffError(500, null) })} />,
    );

    expect((await screen.findByRole("status")).textContent).toContain("保存しました。");
    expect(screen.getByRole("alert").textContent).toContain("HTTP 500");
  });

  it("読み込み中は読み込み中の表示だけを示す", async () => {
    renderWithProviders(<DisplayNameSection form={displayNameForm({ me: null, isLoading: true })} />);

    expect((await screen.findByRole("status")).textContent).toContain("読み込み中");
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

// --------------------------------------------------
// JSON出力
// --------------------------------------------------

describe("BackupExportSection", () => {
  it("出力前に件数の見込みと非公開情報を含むことを示す", async () => {
    renderWithProviders(<BackupExportSection backupExport={backupExport()} />);

    expect(await screen.findByText("外部アカウント: 3件（うち未検証・登録候補 1件）")).toBeDefined();
    expect(screen.getByText("情報提供同意: 2件")).toBeDefined();
    expect(screen.getByText(/非公開の情報（未検証の登録・非公開の設定・情報提供同意）を含みます/)).toBeDefined();
    expect(await isButtonDisabled("JSONを出力")).toBe(false);
  });

  it("件数の見込みを読み込むまでは出力できない", async () => {
    renderWithProviders(<BackupExportSection backupExport={backupExport({ summary: null, isSummaryLoading: true })} />);

    expect(await isButtonDisabled("JSONを出力")).toBe(true);
  });

  it("上限超過の失敗を専用の文言で示す", async () => {
    const exportError = new BffError(413, { type: "about:blank", title: "Too large", status: 413, code: "EXPORT_TOO_LARGE" });
    renderWithProviders(<BackupExportSection backupExport={backupExport({ exportError })} />);

    expect((await screen.findByRole("alert")).textContent).toContain("上限（5MiB）を超える");
  });
});

// --------------------------------------------------
// 復元
// --------------------------------------------------

describe("BackupRestoreSection", () => {
  it("ファイルを選択すると選択したファイルを渡す", async () => {
    const selectFile = vi.fn<(file: File | null) => void>();
    renderWithProviders(<BackupRestoreSection backupRestore={backupRestore({ selectFile })} />);
    const file = new File(["{}"], "backup.json", { type: "application/json" });

    await userEvent.upload(await screen.findByLabelText("バックアップJSONファイル"), file);

    expect(selectFile).toHaveBeenCalledWith(file);
  });

  it("ファイルを選択するまでは「復元する」ボタンを押せない", async () => {
    renderWithProviders(<BackupRestoreSection backupRestore={backupRestore()} />);

    expect(await isButtonDisabled("復元する")).toBe(true);
  });

  it("不備の位置と理由を一覧でalertとして示す", async () => {
    const issues = [
      { code: "INVALID_VALUE", message: "Invalid URL", path: ["externalAccounts", 3, "metadata", "identifiers", 0, "url"] },
      { code: "INVALID_JSON", message: "", path: null },
    ];
    renderWithProviders(<BackupRestoreSection backupRestore={backupRestore({ issues })} />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("externalAccounts[3].metadata.identifiers[0].url: 値が条件を満たしていません。");
    expect(alert.textContent).toContain("Invalid URL");
    expect(alert.textContent).toContain("ファイル全体: JSONの構文が正しくありません。");
  });

  it("Web URLの上限超過は、URLを整理してから再実行するよう案内する", async () => {
    const issues = [{ code: "URL_LIMIT_REACHED", message: "", path: null }];
    renderWithProviders(<BackupRestoreSection backupRestore={backupRestore({ issues })} />);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "ファイル全体: 復元するとWeb URLが上限（150件）を超えます。「アカウント連携」画面でURLを整理してから再実行してください。",
    );
  });

  it("復元の成功を件数とともにstatusで示す", async () => {
    const result = { updatedAccountCount: 2, addedCandidateCount: 1, clientConsentCount: 3 };
    renderWithProviders(<BackupRestoreSection backupRestore={backupRestore({ result })} />);

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("公開設定を戻した外部アカウント: 2件");
    expect(status.textContent).toContain("所有権を証明すると有効になります");
  });
});

// --------------------------------------------------
// 退会
// --------------------------------------------------

describe("AccountDeletionSection", () => {
  it("登録OAuthクライアントが無いことをテキストで示す", async () => {
    renderWithProviders(<AccountDeletionSection accountDeletion={accountDeletion()} />);

    expect(await screen.findByText("登録したOAuthクライアントはありません。")).toBeDefined();
  });

  it("終了する登録OAuthクライアントを示す", async () => {
    const clients = [
      { clientId: "client-1", name: "<b>Points</b>", uri: null, description: null, redirectUris: [], jwks: { keys: [{ kty: "EC" }] } },
    ];
    renderWithProviders(<AccountDeletionSection accountDeletion={accountDeletion({ clients })} />);

    // 外部由来の名前はHTMLとして解釈せず、文字列のまま表示する。
    expect(await screen.findByText("<b>Points</b>")).toBeDefined();
    expect(screen.getByText("(client-1)")).toBeDefined();
  });

  it("確認前は「退会する」ボタンを押せず、チェックで確認を伝える", async () => {
    const changeConfirmed = vi.fn<(isConfirmed: boolean) => void>();
    renderWithProviders(<AccountDeletionSection accountDeletion={accountDeletion({ changeConfirmed })} />);

    expect(await isButtonDisabled("退会する")).toBe(true);
    await userEvent.click(screen.getByRole("checkbox", { name: "内容を確認した" }));
    expect(changeConfirmed).toHaveBeenCalledWith(true);
  });

  it("確認後は「退会する」ボタンで退会する", async () => {
    const deleteAccount = vi.fn<() => Promise<void>>();
    renderWithProviders(
      <AccountDeletionSection accountDeletion={accountDeletion({ isConfirmed: true, canDelete: true, deleteAccount })} />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "退会する" }));

    expect(deleteAccount).toHaveBeenCalledOnce();
  });
});
