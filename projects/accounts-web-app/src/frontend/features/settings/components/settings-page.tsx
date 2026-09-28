import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { useHydratedSession } from "../../../lib/use-hydrated-session";
import { HelpIcon } from "../../app-shell/components/icons";
import { PageMain } from "../../app-shell/components/page-main";
import { SaveBar } from "../../app-shell/components/save-bar";
import { UnsavedChangesDialog } from "../../app-shell/components/unsaved-changes-dialog";
import { useUnsavedChangesGuard } from "../../app-shell/hooks/use-unsaved-changes-guard";
import { SignInRequiredCard } from "../../auth/components/sign-in-required-card";
import { DeveloperSection } from "../../developer/components/developer-section";
import { useOAuthClients } from "../../developer/hooks/use-oauth-clients";
import { useAccountDeletion } from "../hooks/use-account-deletion";
import { useBackupExport } from "../hooks/use-backup-export";
import { useBackupRestore } from "../hooks/use-backup-restore";
import { useDisplayNameForm } from "../hooks/use-display-name-form";
import { settingsMessages } from "../messages";
import { AccountDeletionSection } from "./account-deletion-section";
import { BackupExportSection } from "./backup-export-section";
import { BackupRestoreSection } from "./backup-restore-section";
import { DisplayNameSection } from "./display-name-section";
import { LanguageSection } from "./language-section";
import { ThemeSection } from "./theme-section";

/**
 * 「その他」画面。
 * 設問カードを表示名・言語・テーマ・データ出力・データ取込・開発者向け・退会の順に縦1列で置く。
 * 未ログインでは言語とテーマだけを表示し、ほかの設定はログインを求める1文にする。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ../../../../../docs/specification/v0.1/design-system.ja.md
 * @see ./settings-page.test.tsx
 */
export function SettingsPage() {
  const messages = useMessages(settingsMessages);
  const session = useHydratedSession();

  return (
    <PageMain>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h1 className="text-2xl">{messages.title}</h1>
        <Link
          to="/{-$accountsUserId}/help"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-foreground hover:border-accent hover:no-underline"
        >
          <HelpIcon className="size-4 text-accent" />
          {messages.helpLink}
        </Link>
      </div>
      {session.data === null ? <GuestSettings /> : <SignedInSettings />}
    </PageMain>
  );
}

/**
 * 設問カードの縦の並び（カードの間は --space-4）。
 */
function SettingsCardList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

// --------------------------------------------------
// 未ログイン
// --------------------------------------------------

/**
 * 未ログインの「その他」。
 * ログインダイアログは自動で開かず、「ログインする」で開く。
 */
function GuestSettings() {
  const messages = useMessages(settingsMessages);

  return (
    <SettingsCardList>
      <SignInRequiredCard message={messages.guestSignInRequired} />
      <LanguageSection />
      <ThemeSection />
    </SettingsCardList>
  );
}

// --------------------------------------------------
// ログイン中
// --------------------------------------------------

/**
 * ログイン中の「その他」。
 * 表示名と開発者向けのフォームに未保存の変更がある間は、別画面への移動を確認する。
 */
function SignedInSettings() {
  const common = useMessages(commonMessages);
  const navigate = useNavigate();
  const displayNameForm = useDisplayNameForm();
  const oauthClients = useOAuthClients();
  const backupExport = useBackupExport();
  const backupRestore = useBackupRestore({
    // 取込で表示名が変わるため、読み直す。
    onRestored: displayNameForm.reload,
  });
  const accountDeletion = useAccountDeletion({
    // 退会後は編集中の内容も無効になるため、未保存の確認をせずに移動する。
    onDeleted: () => void navigate({ to: "/", ignoreBlocker: true }),
  });
  const unsavedChangesGuard = useUnsavedChangesGuard(displayNameForm.isDirty || oauthClients.isDirty);

  return (
    <>
      <SettingsCardList>
        <DisplayNameSection form={displayNameForm} />
        <LanguageSection />
        <ThemeSection />
        <BackupExportSection backupExport={backupExport} />
        <BackupRestoreSection displayName={displayNameForm.me?.displayName ?? ""} backupRestore={backupRestore} />
        <DeveloperSection state={oauthClients} />
        <AccountDeletionSection accountDeletion={accountDeletion} />
      </SettingsCardList>
      {displayNameForm.isDirty ? (
        <SaveBar
          dirtyCount={1}
          saveLabel={common.save}
          isSaving={displayNameForm.isSaving}
          isSaveDisabled={!displayNameForm.canSave}
          onDiscard={displayNameForm.discard}
          onSave={() => void displayNameForm.save()}
        />
      ) : null}
      <UnsavedChangesDialog
        isOpen={unsavedChangesGuard.isConfirming}
        onDiscard={unsavedChangesGuard.discardAndLeave}
        onKeepEditing={unsavedChangesGuard.keepEditing}
      />
    </>
  );
}
