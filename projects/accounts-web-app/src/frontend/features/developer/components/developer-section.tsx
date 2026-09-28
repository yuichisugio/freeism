import { Button } from "@heroui/react";

import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { PlusIcon } from "../../app-shell/components/icons";
import { ErrorNotice, LoadingState, SuccessNotice } from "../../app-shell/components/status-messages";
import { UnsavedChangesDialog } from "../../app-shell/components/unsaved-changes-dialog";
import { SettingsSection } from "../../settings/components/settings-section";
import type { OAuthClientFeedback, OAuthClientsState } from "../hooks/use-oauth-clients";
import { developerMessages } from "../messages";
import { DeleteOAuthClientDialog } from "./delete-oauth-client-dialog";
import { OAuthClientEditor } from "./oauth-client-editor";
import { OAuthClientList } from "./oauth-client-list";

/**
 * 「その他」画面の「開発者向け」。
 * 登録済みのOAuthクライアントの一覧と「新しいクライアントを登録」を置き、登録・編集のフォームは一覧の下に開く。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./developer-section.test.tsx
 */
export function DeveloperSection({ state }: { state: OAuthClientsState }) {
  const messages = useMessages(developerMessages);
  const common = useMessages(commonMessages);

  return (
    <SettingsSection title={messages.title} description={messages.intro}>
      {state.status === "loading" ? <LoadingState /> : null}
      {state.status === "error" ? (
        <>
          <ErrorNotice error={state.loadError} />
          <Button size="sm" variant="outline" onPress={state.reload}>
            {common.retry}
          </Button>
        </>
      ) : null}
      {state.status === "ready" ? (
        <>
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">{messages.clientListTitle}</h3>
            <Button size="sm" variant="outline" isDisabled={!state.canCreate} onPress={state.startCreating}>
              <PlusIcon className="size-4" />
              {messages.createClient}
            </Button>
          </div>
          <OAuthClientList
            clients={state.clients}
            editTarget={state.editTarget}
            onEdit={state.editClient}
            onDelete={state.requestDelete}
          />
          {state.canCreate ? null : <p className="text-sm text-muted">{messages.clientLimitReached}</p>}
          <OAuthClientEditor state={state} />
          <FeedbackNotice feedback={state.feedback} />
        </>
      ) : null}

      <DeleteOAuthClientDialog
        isOpen={state.isDeleteConfirming}
        isDeleting={state.isDeleting}
        onConfirm={() => void state.confirmDelete()}
        onCancel={state.cancelDelete}
      />
      <UnsavedChangesDialog
        isOpen={state.isSwitchConfirming}
        onDiscard={state.discardAndSwitch}
        onKeepEditing={state.keepEditing}
      />
    </SettingsSection>
  );
}

/**
 * 保存・削除の結果の通知。
 */
function FeedbackNotice({ feedback }: { feedback: OAuthClientFeedback | null }) {
  const messages = useMessages(developerMessages);
  const common = useMessages(commonMessages);

  switch (feedback?.kind) {
    case "created":
      return <SuccessNotice>{messages.created}</SuccessNotice>;
    case "saved":
      return <SuccessNotice>{common.saved}</SuccessNotice>;
    case "deleted":
      return <SuccessNotice>{messages.deleted}</SuccessNotice>;
    case "saveFailed":
    case "deleteFailed":
      return <ErrorNotice error={feedback.error} codeMessages={messages.codeMessages} />;
    default:
      return null;
  }
}
