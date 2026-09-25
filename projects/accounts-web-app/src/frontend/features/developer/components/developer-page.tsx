import { Button } from "@heroui/react";
import { useId } from "react";

import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { ErrorNotice, LoadingState, SuccessNotice } from "../../app-shell/components/status-messages";
import { UnsavedChangesDialog } from "../../app-shell/components/unsaved-changes-dialog";
import type { OAuthClientFeedback, OAuthClientsState } from "../hooks/use-oauth-clients";
import { developerMessages } from "../messages";
import { DeleteOAuthClientDialog } from "./delete-oauth-client-dialog";
import { OAuthClientEditor } from "./oauth-client-editor";
import { OAuthClientList } from "./oauth-client-list";

/**
 * 「開発者向け」画面。
 * OAuthクライアントの一覧・編集・削除と、OpenAPIのドキュメントへのリンクを置く。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./developer-page.test.tsx
 */
export function DeveloperPage({ state }: { state: OAuthClientsState }) {
  const messages = useMessages(developerMessages);
  const common = useMessages(commonMessages);

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{messages.title}</h1>
        <p className="text-sm text-muted">{messages.intro}</p>
      </header>

      {state.status === "loading" ? <LoadingState /> : null}
      {state.status === "error" ? (
        <div className="space-y-3">
          <ErrorNotice error={state.loadError} />
          <Button variant="outline" onPress={state.reload}>
            {common.retry}
          </Button>
        </div>
      ) : null}
      {state.status === "ready" ? (
        <div className="grid gap-8 md:grid-cols-[16rem_1fr]">
          <OAuthClientList
            clients={state.clients}
            editTarget={state.editTarget}
            canCreate={state.canCreate}
            onSelect={state.selectClient}
            onCreate={state.startCreating}
          />
          <div className="space-y-4">
            {state.editTarget === null ? (
              <p className="text-sm text-muted">{messages.selectClientPrompt}</p>
            ) : (
              <OAuthClientEditor state={state} />
            )}
            <FeedbackNotice feedback={state.feedback} />
          </div>
        </div>
      ) : null}

      <DeveloperDocsLinks />

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
    </main>
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

/**
 * Accounts APIとBetter Auth APIのOpenAPIドキュメントへのリンク。
 */
function DeveloperDocsLinks() {
  const messages = useMessages(developerMessages);
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h2 id={headingId} className="text-lg font-semibold">
        {messages.docsTitle}
      </h2>
      <p className="text-sm text-muted">{messages.docsIntro}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>
          <a href="/api/v1/openapi.json" className="underline">
            {messages.accountsApiDocs}
          </a>
        </li>
        <li>
          <a href="/api/auth/reference" className="underline">
            {messages.authApiDocs}
          </a>
        </li>
      </ul>
    </section>
  );
}
