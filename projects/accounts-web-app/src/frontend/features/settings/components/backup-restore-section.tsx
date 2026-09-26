import { Alert, Button } from "@heroui/react";
import { useId } from "react";

import type { ProblemIssue } from "../../../../shared/schemas/problem-details-schema";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { ErrorNotice, SuccessNotice } from "../../app-shell/components/status-messages";
import { formatIssuePath } from "../backup-file";
import type { BackupRestore } from "../hooks/use-backup-restore";
import { settingsMessages } from "../messages";
import { SettingsSection } from "./settings-section";

/**
 * JSON復元。
 * ファイルを選択して「復元する」で実行し、結果または不備の一覧を示す。
 * @see ./settings-sections.test.tsx
 */
export function BackupRestoreSection({ backupRestore }: { backupRestore: BackupRestore }) {
  const messages = useMessages(settingsMessages);
  const fileInputId = useId();
  const { result } = backupRestore;

  return (
    <SettingsSection title={messages.restoreTitle} description={messages.restoreDescription}>
      <div className="flex flex-col gap-1">
        <label htmlFor={fileInputId} className="text-sm font-medium">
          {messages.restoreFileLabel}
        </label>
        <input
          id={fileInputId}
          type="file"
          accept="application/json,.json"
          className="text-sm"
          onChange={(event) => backupRestore.selectFile(event.currentTarget.files?.[0] ?? null)}
        />
      </div>
      <Button
        variant="secondary"
        isDisabled={!backupRestore.canRestore}
        onPress={() => void backupRestore.restore()}
      >
        {backupRestore.isRestoring ? messages.restoring : messages.restoreButton}
      </Button>
      {backupRestore.issues.length > 0 ? <RestoreIssueList issues={backupRestore.issues} /> : null}
      {backupRestore.restoreError === null ? null : (
        <ErrorNotice error={backupRestore.restoreError} codeMessages={messages.codeMessages} />
      )}
      {result === null ? null : (
        <SuccessNotice>
          {result.addedCandidateCount > 0
            ? `${messages.restored(result)} ${messages.restoredCandidateHint}`
            : messages.restored(result)}
        </SuccessNotice>
      )}
    </SettingsSection>
  );
}

/**
 * 復元できなかったJSONの不備の一覧。
 * 位置と、エラーコードの文言・具体的な理由を並べる。
 */
function RestoreIssueList({ issues }: { issues: ProblemIssue[] }) {
  const messages = useMessages(settingsMessages);
  return (
    <Alert status="danger" role="alert">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{messages.restoreIssuesTitle}</Alert.Title>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {issues.map((issue, index) => (
            // 不備の一覧は並べ替えないため、位置をkeyにする。
            <li key={index}>
              <code className="break-all">{formatIssuePath(issue.path) ?? messages.issueWholeFile}</code>
              {`: ${messages.codeMessages[issue.code] ?? issue.code}`}
              {issue.message === "" ? null : <span className="block text-muted">{issue.message}</span>}
            </li>
          ))}
        </ul>
      </Alert.Content>
    </Alert>
  );
}
