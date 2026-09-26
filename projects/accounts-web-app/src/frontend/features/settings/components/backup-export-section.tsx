import { Button } from "@heroui/react";

import { useMessages } from "../../../lib/i18n/i18n-provider";
import { ErrorNotice, SuccessNotice } from "../../app-shell/components/status-messages";
import type { BackupExport } from "../hooks/use-backup-export";
import { settingsMessages } from "../messages";
import { LoadStatus } from "./load-status";
import { SettingsSection } from "./settings-section";

/**
 * JSON出力。
 * 出力前に件数の見込みと非公開情報を含むかを示す。
 * @see ./settings-sections.test.tsx
 */
export function BackupExportSection({ backupExport }: { backupExport: BackupExport }) {
  const messages = useMessages(settingsMessages);
  const { summary } = backupExport;

  return (
    <SettingsSection title={messages.exportTitle} description={messages.exportDescription}>
      {summary === null ? (
        <LoadStatus error={backupExport.summaryError} onRetry={backupExport.reloadSummary} />
      ) : (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>{messages.exportAccountCount(summary.externalAccountCount, summary.unverifiedAccountCount)}</li>
          <li>{messages.exportConsentCount(summary.clientConsentCount)}</li>
          <li>{summary.includesPrivateData ? messages.exportIncludesPrivateData : messages.exportNoPrivateData}</li>
        </ul>
      )}
      <Button
        variant="secondary"
        isDisabled={summary === null || backupExport.isExporting}
        onPress={() => void backupExport.exportBackup()}
      >
        {backupExport.isExporting ? messages.exporting : messages.exportButton}
      </Button>
      {backupExport.exportError === null ? null : (
        <ErrorNotice error={backupExport.exportError} codeMessages={messages.codeMessages} />
      )}
      {backupExport.isExported ? <SuccessNotice>{messages.exported}</SuccessNotice> : null}
    </SettingsSection>
  );
}
