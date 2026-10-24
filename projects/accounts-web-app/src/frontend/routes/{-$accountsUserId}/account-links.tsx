import { Link, createFileRoute, useLocation } from "@tanstack/react-router";

import { ExternalUrlForm } from "../../features/account-links/components/external-url-form";
import { ProfileUrlPanel } from "../../features/account-links/components/profile-url-panel";
import { ProviderLinkButtons } from "../../features/account-links/components/provider-link-buttons";
import { UnlinkDialog } from "../../features/account-links/components/unlink-dialog";
import { UnpublishedMessages } from "../../features/account-links/components/unpublished-messages";
import { VisibilityTable } from "../../features/account-links/components/visibility-table";
import { useAccountLinks } from "../../features/account-links/hooks/use-account-links";
import { useExternalUrlForm } from "../../features/account-links/hooks/use-external-url-form";
import { useProviderLink } from "../../features/account-links/hooks/use-provider-link";
import { useReverify } from "../../features/account-links/hooks/use-reverify";
import { useUnlink } from "../../features/account-links/hooks/use-unlink";
import { accountLinksMessages } from "../../features/account-links/messages";
import { HelpIcon } from "../../features/app-shell/components/icons";
import { PageMain } from "../../features/app-shell/components/page-main";
import { SaveBar } from "../../features/app-shell/components/save-bar";
import { ErrorNotice, LoadingState, SuccessNotice } from "../../features/app-shell/components/status-messages";
import { UnsavedChangesDialog } from "../../features/app-shell/components/unsaved-changes-dialog";
import { useUnsavedChangesGuard } from "../../features/app-shell/hooks/use-unsaved-changes-guard";
import { useMessages } from "../../lib/i18n/i18n-provider";
import type { RawSearch } from "../../lib/search-params";

/**
 * 「アカウント連携」画面。
 * 公開プロフィールURL → URLで証明 → ログインで証明 → 公開設定（表・情報メッセージ・保存バー）の縦1列にする。
 * 追加連携の失敗はBetter Authが`?error=`を付けて戻すため、クエリを受け取る。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ../../../../docs/specification/v0.1/design-system/design-system.ja.md
 */
export const Route = createFileRoute("/{-$accountsUserId}/account-links")({
  validateSearch: (search: Record<string, unknown>) => search as RawSearch,
  component: AccountLinksPage,
});

function AccountLinksPage() {
  const messages = useMessages(accountLinksMessages);
  const search = Route.useSearch();
  const accountLinks = useAccountLinks();
  const urlForm = useExternalUrlForm({ onSaved: accountLinks.reload });
  const reverify = useReverify({ onVerified: accountLinks.reload });
  const unlink = useUnlink({ onUnlinked: accountLinks.reload });
  const pathname = useLocation({ select: (location) => location.pathname });
  const providerLink = useProviderLink(pathname);
  const changeCount = accountLinks.table?.changeCount ?? 0;
  const guard = useUnsavedChangesGuard(changeCount > 0);

  const { links, table, loadState, saveState } = accountLinks;
  const urlCount =
    links?.accounts.reduce(
      (count, account) => count + account.identifiers.filter((identifier) => identifier.type === "url").length,
      0,
    ) ?? 0;
  const callbackError = typeof search.error === "string" ? search.error : null;

  return (
    <PageMain>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h1 className="text-2xl">{messages.title}</h1>
        <Link
          to="/{-$accountsUserId}/help"
          hash="account-links"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-foreground hover:border-accent hover:no-underline"
        >
          <HelpIcon className="size-4 text-accent" />
          {messages.helpLink}
        </Link>
      </div>

      {loadState.status === "loading" ? <LoadingState /> : null}
      {loadState.status === "error" ? <ErrorNotice error={loadState.error} /> : null}

      {links === null || table === null ? null : (
        <>
          <ProfileUrlPanel profileUrl={links.profileUrl} />
          <ExternalUrlForm
            url={urlForm.url}
            onUrlChange={urlForm.setUrl}
            validationError={urlForm.validationError}
            submittingMode={urlForm.submittingMode}
            onSubmit={(mode) => void urlForm.submit(mode)}
            outcome={urlForm.outcome}
            error={urlForm.error}
            urlInputErrorCode={urlForm.urlInputErrorCode}
            urlCount={urlCount}
          />
          <ProviderLinkButtons
            pendingProvider={providerLink.pendingProvider}
            hasStartFailed={providerLink.error !== null}
            callbackError={callbackError}
            onLink={(provider) => void providerLink.link(provider)}
          />

          <h2 className="text-xl">{messages.visibilityTitle}</h2>
          <VisibilityTable
            table={table}
            reverifyingAccountId={reverify.pendingAccountId}
            reverifyFailure={reverify.failure}
            isSelectionDisabled={saveState.status === "saving"}
            onSelect={accountLinks.select}
            onRequestUnlink={unlink.request}
            onReverify={(account) => void reverify.reverify(account)}
          />
          <div aria-live="polite" className="flex flex-col gap-2 empty:hidden">
            <UnpublishedMessages columns={table.columns} />
            {unlink.doneKind === null ? null : (
              <SuccessNotice>
                {unlink.doneKind === "account" ? messages.accountUnlinked : messages.verificationUnlinked}
              </SuccessNotice>
            )}
            {saveState.status === "saved" ? <SuccessNotice>{messages.visibilitySaved}</SuccessNotice> : null}
            {saveState.status === "error" ? <ErrorNotice error={saveState.error} codeMessages={messages.errorCodes} /> : null}
          </div>
          <SaveBar
            dirtyCount={changeCount}
            saveLabel={messages.saveVisibility}
            isSaving={saveState.status === "saving"}
            onDiscard={accountLinks.discardEdits}
            onSave={() => void accountLinks.save()}
          />
        </>
      )}

      <UnlinkDialog
        target={unlink.target}
        isSubmitting={unlink.isSubmitting}
        error={unlink.error}
        onConfirm={() => void unlink.confirm()}
        onCancel={unlink.cancel}
      />
      <UnsavedChangesDialog
        isOpen={guard.isConfirming}
        onDiscard={() => {
          accountLinks.discardEdits();
          guard.discardAndLeave();
        }}
        onKeepEditing={guard.keepEditing}
      />
    </PageMain>
  );
}
