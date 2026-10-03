// @vitest-environment happy-dom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { ThemeSection } from "./theme-section";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  vi.restoreAllMocks();
});

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
    displayNameLength: 5,
    issue: null,
    isDirty: false,
    canSave: false,
    isSaving: false,
    isSaved: false,
    saveError: null,
    changeDisplayName: vi.fn<(value: string) => void>(),
    discard: vi.fn<() => void>(),
    save: vi.fn<() => Promise<void>>(),
    ...overrides,
  };
}

function backupExport(overrides: Partial<BackupExport> = {}): BackupExport {
  return {
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
    isDialogOpen: false,
    openDialog: vi.fn<() => void>(),
    closeDialog: vi.fn<() => void>(),
    confirmationText: "",
    changeConfirmationText: vi.fn<(value: string) => void>(),
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

/**
 * ダウンロードさせたファイルの名前と内容を記録する。
 */
function captureDownloads() {
  const downloads: { fileName: string; blob: Blob }[] = [];
  let lastBlob: Blob | null = null;
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    lastBlob = blob as Blob;
    return "blob:download";
  });
  vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    if (lastBlob !== null) downloads.push({ fileName: this.download, blob: lastBlob });
  });
  return downloads;
}

// --------------------------------------------------
// 言語
// --------------------------------------------------

describe("LanguageSection", () => {
  it("現在の言語を選択済みにし、選んだ言語ですぐに表示してこのブラウザーに保存する", async () => {
    renderWithProviders(<LanguageSection />);

    expect(await screen.findByText("既定はブラウザーの言語です。")).toBeDefined();
    expect(screen.getByRole<HTMLInputElement>("radio", { name: "日本語" }).checked).toBe(true);
    await userEvent.click(screen.getByRole("radio", { name: "English" }));

    expect(await screen.findByRole("heading", { name: "Language" })).toBeDefined();
    expect(screen.getByRole<HTMLInputElement>("radio", { name: "English" }).checked).toBe(true);
    expect(window.localStorage.getItem("accounts.language")).toBe("en");
  });
});

// --------------------------------------------------
// テーマ
// --------------------------------------------------

describe("ThemeSection", () => {
  it("既定はシステムで、選んだテーマをすぐに反映してこのブラウザーに保存する", async () => {
    renderWithProviders(<ThemeSection />);

    expect((await screen.findByRole<HTMLInputElement>("radio", { name: "システム" })).checked).toBe(true);
    await userEvent.click(screen.getByRole("radio", { name: "ダーク" }));

    expect(screen.getByRole<HTMLInputElement>("radio", { name: "ダーク" }).checked).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem("accounts.theme")).toBe("dark");
  });
});

// --------------------------------------------------
// 表示名
// --------------------------------------------------

describe("DisplayNameSection", () => {
  it("保存済みの表示名と文字数を表示し、AccountsユーザーIDは表示しない", async () => {
    renderWithProviders(<DisplayNameSection form={displayNameForm()} />);

    expect((await screen.findByRole<HTMLInputElement>("textbox", { name: "表示名" })).value).toBe("仮ユーザー");
    expect(screen.getByText("5 / 50")).toBeDefined();
    expect(screen.getByText("公開プロフィールと連携先に表示されます。")).toBeDefined();
    expect(screen.queryByText(/ユーザーID/)).toBeNull();
    expect(screen.queryByRole("button", { name: "保存" })).toBeNull();
  });

  it("入力すると変更を伝える", async () => {
    const changeDisplayName = vi.fn<(value: string) => void>();
    renderWithProviders(<DisplayNameSection form={displayNameForm({ displayName: "", changeDisplayName })} />);

    await userEvent.type(await screen.findByRole("textbox", { name: "表示名" }), "A");

    expect(changeDisplayName).toHaveBeenCalledWith("A");
  });

  it("保存中は入力欄を無効にする", async () => {
    renderWithProviders(<DisplayNameSection form={displayNameForm({ displayName: "Alice", isDirty: true, isSaving: true })} />);

    expect((await screen.findByRole<HTMLInputElement>("textbox", { name: "表示名" })).disabled).toBe(true);
  });

  it("入力不備は理由をテキストで示す", async () => {
    renderWithProviders(
      <DisplayNameSection
        form={displayNameForm({ displayName: "あ".repeat(51), displayNameLength: 51, issue: "tooLong", isDirty: true })}
      />,
    );

    expect(await screen.findByText("表示名は50文字以内で入力してください。")).toBeDefined();
    expect(screen.getByText("51 / 50")).toBeDefined();
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
// データ出力
// --------------------------------------------------

describe("BackupExportSection", () => {
  it("説明と「データ出力」ボタンだけを示し、押すと出力する", async () => {
    const exportBackup = vi.fn<() => Promise<void>>();
    renderWithProviders(<BackupExportSection backupExport={backupExport({ exportBackup })} />);

    expect(await screen.findByText("このサービスに保存したデータを出力します。")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "データ出力" }));

    expect(exportBackup).toHaveBeenCalledOnce();
  });

  it("上限超過の失敗を専用の文言で示す", async () => {
    const exportError = new BffError(413, { type: "about:blank", title: "Too large", status: 413, code: "EXPORT_TOO_LARGE" });
    renderWithProviders(<BackupExportSection backupExport={backupExport({ exportError })} />);

    expect((await screen.findByRole("alert")).textContent).toContain("上限（5MiB）を超える");
  });
});

// --------------------------------------------------
// データ取込
// --------------------------------------------------

describe("BackupRestoreSection", () => {
  it("ファイルを選択すると選択したファイルを渡す", async () => {
    const selectFile = vi.fn<(file: File | null) => void>();
    renderWithProviders(<BackupRestoreSection displayName="仮ユーザー" backupRestore={backupRestore({ selectFile })} />);
    const file = new File(["{}"], "backup.json", { type: "application/json" });

    await userEvent.upload(await screen.findByLabelText("ファイルを選択"), file);

    expect(selectFile).toHaveBeenCalledWith(file);
  });

  it("選択後に入力を空に戻し、修正した同じファイルを選び直せる", async () => {
    const selectFile = vi.fn<(file: File | null) => void>();
    renderWithProviders(<BackupRestoreSection displayName="仮ユーザー" backupRestore={backupRestore({ selectFile })} />);
    const input = await screen.findByLabelText<HTMLInputElement>("ファイルを選択");
    const file = new File(["{}"], "backup.json", { type: "application/json" });

    await userEvent.upload(input, file);
    await userEvent.upload(input, file);

    expect(input.value).toBe("");
    expect(selectFile).toHaveBeenCalledTimes(2);
  });

  it("ファイルを選択するまでは「取り込む」ボタンを押せず、選択後はファイル名を示す", async () => {
    renderWithProviders(<BackupRestoreSection displayName="仮ユーザー" backupRestore={backupRestore()} />);

    expect(await screen.findByText("選択されていません")).toBeDefined();
    expect(await isButtonDisabled("取り込む")).toBe(true);
  });

  it("選択したファイル名を示し、「取り込む」ボタンで取り込む", async () => {
    const restore = vi.fn<() => Promise<void>>();
    const file = new File(["{}"], "accounts-backup.json", { type: "application/json" });
    renderWithProviders(<BackupRestoreSection displayName="仮ユーザー" backupRestore={backupRestore({ file, canRestore: true, restore })} />);

    expect(await screen.findByText("accounts-backup.json")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "取り込む" }));

    expect(restore).toHaveBeenCalledOnce();
  });

  it("「テンプレートをダウンロード」で出力JSONと同じ形式のテンプレートをダウンロードさせる", async () => {
    const downloads = captureDownloads();
    renderWithProviders(<BackupRestoreSection displayName="仮ユーザー" backupRestore={backupRestore()} />);

    await userEvent.click(await screen.findByRole("button", { name: "テンプレートをダウンロード" }));

    expect(downloads.map((download) => download.fileName)).toEqual(["accounts-import-template.json"]);
    expect(JSON.parse(await downloads[0]!.blob.text())).toMatchObject({
      schemaVersion: 1,
      profile: { displayName: "仮ユーザー" },
    });
  });

  it("「AIに整形を頼む文面をコピー」で依頼文とテンプレートをコピーする", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BackupRestoreSection displayName="仮ユーザー" backupRestore={backupRestore()} />);

    await user.click(await screen.findByRole("button", { name: "AIに整形を頼む文面をコピー" }));

    const copied = await navigator.clipboard.readText();
    expect(copied).toContain("テンプレート");
    expect(copied).toContain('"schemaVersion": 1');
    expect(copied).toContain('"displayName": "仮ユーザー"');
    expect(copied).toContain("profile.displayName はテンプレートの値のままにしてください。");
    expect(await screen.findByText("コピーしました。")).toBeDefined();
  });

  it("不備の位置と理由を一覧でalertとして示す", async () => {
    const issues = [
      { code: "INVALID_VALUE", message: "Invalid URL", path: ["externalAccounts", 3, "metadata", "identifiers", 0, "url"] },
      { code: "INVALID_JSON", message: "", path: null },
    ];
    renderWithProviders(<BackupRestoreSection displayName="仮ユーザー" backupRestore={backupRestore({ issues })} />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("externalAccounts[3].metadata.identifiers[0].url: 値が条件を満たしていません。");
    expect(alert.textContent).toContain("Invalid URL");
    expect(alert.textContent).toContain("ファイル全体: JSONの構文が正しくありません。");
  });

  it("不備の一覧は「取り込む」の直下（テンプレートの操作より上）に示す", async () => {
    const issues = [{ code: "INVALID_JSON", message: "", path: null }];
    renderWithProviders(<BackupRestoreSection displayName="仮ユーザー" backupRestore={backupRestore({ issues })} />);

    const alert = await screen.findByRole("alert");
    const importButton = screen.getByRole("button", { name: "取り込む" });
    const templateButton = screen.getByRole("button", { name: "テンプレートをダウンロード" });
    expect(importButton.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(alert.compareDocumentPosition(templateButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Web URLの上限超過は、URLを整理してから再実行するよう案内する", async () => {
    const issues = [{ code: "URL_LIMIT_REACHED", message: "", path: null }];
    renderWithProviders(<BackupRestoreSection displayName="仮ユーザー" backupRestore={backupRestore({ issues })} />);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "ファイル全体: 復元するとWeb URLが上限（150件）を超えます。「アカウント連携」画面でURLを整理してから再実行してください。",
    );
  });

  it("取込の成功を件数とともにstatusで示す", async () => {
    const result = { updatedAccountCount: 2, addedCandidateCount: 1 };
    renderWithProviders(<BackupRestoreSection displayName="仮ユーザー" backupRestore={backupRestore({ result })} />);

    const statusTexts = (await screen.findAllByRole("status")).map((status) => status.textContent).join("\n");
    expect(statusTexts).toContain("公開設定を戻した外部アカウント: 2件");
    expect(statusTexts).toContain("登録候補として追加: 1件");
    expect(statusTexts).not.toContain("連携先");
    expect(statusTexts).toContain("所有権を証明すると有効になります");
  });
});

// --------------------------------------------------
// 退会
// --------------------------------------------------

describe("AccountDeletionSection", () => {
  it("説明と「退会」ボタンを示し、押すと退会の確認を開く", async () => {
    const openDialog = vi.fn<() => void>();
    renderWithProviders(<AccountDeletionSection accountDeletion={accountDeletion({ openDialog })} />);

    expect(await screen.findByText("Freeism Accounts のデータをすべて削除します。")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "退会" }));

    expect(openDialog).toHaveBeenCalledOnce();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("確認では取り消せないことを示し、「DELETE」の入力を伝える", async () => {
    const changeConfirmationText = vi.fn<(value: string) => void>();
    renderWithProviders(
      <AccountDeletionSection accountDeletion={accountDeletion({ isDialogOpen: true, changeConfirmationText })} />,
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("heading", { name: "退会しますか？" })).toBeDefined();
    expect(dialog.textContent).toContain("この操作は取り消せません。必要なら先に「データ出力」で保存してください。");
    expect(within(dialog).getByRole<HTMLButtonElement>("button", { name: "退会する" }).disabled).toBe(true);
    await userEvent.type(within(dialog).getByRole("textbox", { name: "確認のため「DELETE」と入力" }), "D");

    expect(changeConfirmationText).toHaveBeenCalledWith("D");
  });

  it("入力が一致したら「退会する」ボタンで退会する", async () => {
    const deleteAccount = vi.fn<() => Promise<void>>();
    renderWithProviders(
      <AccountDeletionSection
        accountDeletion={accountDeletion({ isDialogOpen: true, confirmationText: "DELETE", canDelete: true, deleteAccount })}
      />,
    );

    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "退会する" }));

    expect(deleteAccount).toHaveBeenCalledOnce();
  });

  it("「キャンセル」で確認を閉じる", async () => {
    const closeDialog = vi.fn<() => void>();
    renderWithProviders(<AccountDeletionSection accountDeletion={accountDeletion({ isDialogOpen: true, closeDialog })} />);

    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "キャンセル" }));

    expect(closeDialog).toHaveBeenCalledOnce();
  });
});
