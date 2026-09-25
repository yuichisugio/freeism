import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { UnsavedChangesDialog } from "../features/app-shell/components/unsaved-changes-dialog";
import { useUnsavedChangesGuard } from "../features/app-shell/hooks/use-unsaved-changes-guard";
import { AccountDeletionSection } from "../features/settings/components/account-deletion-section";
import { BackupExportSection } from "../features/settings/components/backup-export-section";
import { BackupRestoreSection } from "../features/settings/components/backup-restore-section";
import { DisplayNameSection } from "../features/settings/components/display-name-section";
import { useAccountDeletion } from "../features/settings/hooks/use-account-deletion";
import { useBackupExport } from "../features/settings/hooks/use-backup-export";
import { useBackupRestore } from "../features/settings/hooks/use-backup-restore";
import { useDisplayNameForm } from "../features/settings/hooks/use-display-name-form";
import { settingsMessages } from "../features/settings/messages";
import { useMessages } from "../lib/i18n/i18n-provider";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

/**
 * 「設定」画面。
 * 表示名の編集、JSON出力・復元、退会をそれぞれの操作から実行する。
 * @see ../../../docs/specification/v0.1/main.ja.md
 */
function SettingsPage() {
  const messages = useMessages(settingsMessages);
  const navigate = useNavigate();
  const displayNameForm = useDisplayNameForm();
  const backupExport = useBackupExport();
  const backupRestore = useBackupRestore({
    // 復元で表示名と出力対象の件数が変わるため、読み直す。
    onRestored: () => {
      displayNameForm.reload();
      backupExport.reloadSummary();
    },
  });
  const accountDeletion = useAccountDeletion({
    // 退会後は編集中の表示名も無効になるため、未保存の確認をせずに移動する。
    onDeleted: () => void navigate({ to: "/", ignoreBlocker: true }),
  });
  const unsavedChangesGuard = useUnsavedChangesGuard(displayNameForm.isDirty);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{messages.title}</h1>
      <DisplayNameSection form={displayNameForm} />
      <BackupExportSection backupExport={backupExport} />
      <BackupRestoreSection backupRestore={backupRestore} />
      <AccountDeletionSection accountDeletion={accountDeletion} />
      <UnsavedChangesDialog
        isOpen={unsavedChangesGuard.isConfirming}
        onDiscard={unsavedChangesGuard.discardAndLeave}
        onKeepEditing={unsavedChangesGuard.keepEditing}
      />
    </main>
  );
}
