import { Button } from "@heroui/react";

import { useMessages } from "../../../lib/i18n/i18n-provider";
import { DownloadIcon } from "../../app-shell/components/icons";
import { ErrorNotice, SuccessNotice } from "../../app-shell/components/status-messages";
import type { BackupExport } from "../hooks/use-backup-export";
import { settingsMessages } from "../messages";
import { SettingsSection } from "./settings-section";

/**
 * データ出力。
 * 「データ出力」でバックアップJSONをダウンロードさせる。
 * @see ./settings-sections.test.tsx
 */
export function BackupExportSection({ backupExport }: { backupExport: BackupExport }) {
  const messages = useMessages(settingsMessages);

  return (
    <SettingsSection title={messages.exportTitle} description={messages.exportDescription}>
      <Button variant="outline" isPending={backupExport.isExporting} onPress={() => void backupExport.exportBackup()}>
        <DownloadIcon className="size-4" />
        {backupExport.isExporting ? messages.exporting : messages.exportButton}
      </Button>
      {backupExport.exportError === null ? null : (
        <ErrorNotice error={backupExport.exportError} codeMessages={messages.codeMessages} />
      )}
      {backupExport.isExported ? <SuccessNotice>{messages.exported}</SuccessNotice> : null}
    </SettingsSection>
  );
}
