import { Alert, Button, buttonVariants } from "@heroui/react";

import type { ProblemIssue } from "../../../../shared/schemas/problem-details-schema";
import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { useCopyText } from "../../../lib/use-copy-text";
import { CopyIcon, DownloadIcon, UploadIcon } from "../../app-shell/components/icons";
import { ErrorNotice, SuccessNotice } from "../../app-shell/components/status-messages";
import { formatIssuePath } from "../backup-file";
import type { BackupRestore } from "../hooks/use-backup-restore";
import { buildImportTemplateText, downloadImportTemplate } from "../import-template";
import { settingsMessages } from "../messages";
import { SettingsSection } from "./settings-section";

/**
 * データ取込。
 * JSONファイルを選択して「取り込む」で復元し、結果または不備の一覧を「取り込む」の直下に示す。
 * 出力JSONと同じ形式のテンプレートのダウンロードと、ほかのサービスのデータをその形式へ整形するようAIに頼む文面のコピーを置く。
 * テンプレートの `profile.displayName` には現在の表示名を入れる。
 * @see ./settings-sections.test.tsx
 */
export function BackupRestoreSection({
  displayName,
  backupRestore,
}: {
  displayName: string;
  backupRestore: BackupRestore;
}) {
  const messages = useMessages(settingsMessages);
  const common = useMessages(commonMessages);
  const aiPromptCopy = useCopyText();
  const importTemplateText = buildImportTemplateText(displayName);
  const aiPrompt = messages.aiPrompt(importTemplateText);
  const { result } = backupRestore;

  return (
    <SettingsSection title={messages.importTitle} description={messages.importDescription}>
      <div className="flex flex-wrap items-center gap-2">
        <label
          className={`${buttonVariants({ variant: "outline", size: "sm" })} cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus)`}
        >
          <UploadIcon className="size-4" />
          {messages.chooseFile}
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => {
              backupRestore.selectFile(event.currentTarget.files?.[0] ?? null);
              // 修正した同じファイルを選び直しても変更として扱われるよう、入力を空に戻す。
              event.currentTarget.value = "";
            }}
          />
        </label>
        <span className="text-xs break-all text-muted">{backupRestore.file?.name ?? messages.noFileChosen}</span>
      </div>
      <Button
        size="sm"
        variant="primary"
        isDisabled={!backupRestore.canRestore}
        onPress={() => void backupRestore.restore()}
      >
        {backupRestore.isRestoring ? messages.importing : messages.importButton}
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
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="tertiary" onPress={() => downloadImportTemplate(importTemplateText)}>
          <DownloadIcon className="size-4" />
          {messages.downloadTemplate}
        </Button>
        <Button size="sm" variant="tertiary" onPress={() => void aiPromptCopy.copy(aiPrompt)}>
          <CopyIcon className="size-4" />
          {messages.copyAiPrompt}
        </Button>
        <span role="status" className="text-sm text-muted">
          {aiPromptCopy.status === "copied" ? common.copied : aiPromptCopy.status === "failed" ? common.copyFailed : ""}
        </span>
      </div>
      <details className="w-full text-sm">
        <summary className="cursor-pointer text-xs text-muted">{messages.showAiPrompt}</summary>
        <pre className="mt-2 max-h-[280px] overflow-auto rounded-lg border border-border bg-surface-secondary px-4 py-3 font-mono text-xs whitespace-pre-wrap">
          {aiPrompt}
        </pre>
      </details>
    </SettingsSection>
  );
}

/**
 * 取り込めなかったJSONの不備の一覧。
 * 位置と、エラーコードの文言・具体的な理由を並べる。
 */
function RestoreIssueList({ issues }: { issues: ProblemIssue[] }) {
  const messages = useMessages(settingsMessages);
  return (
    <Alert status="danger" role="alert" className="w-full">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{messages.restoreIssuesTitle}</Alert.Title>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {issues.map((issue, index) => (
            // 不備の一覧は並べ替えないため、位置をkeyにする。
            <li key={index}>
              <code className="break-all">{formatIssuePath(issue.path) ?? messages.issueWholeFile}</code>
              {`: ${messages.codeMessages[issue.code] ?? issue.code}`}
              {issue.message === "" ? null : <span className="block text-xs text-muted">{issue.message}</span>}
            </li>
          ))}
        </ul>
      </Alert.Content>
    </Alert>
  );
}
