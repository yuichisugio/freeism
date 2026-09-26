import { Card } from "@heroui/react";
import { Link, createFileRoute, useLocation } from "@tanstack/react-router";

import { ConsentPanel } from "../../features/account-links/components/consent-panel";
import { ExternalUrlForm } from "../../features/account-links/components/external-url-form";
import { ProfileUrlPanel } from "../../features/account-links/components/profile-url-panel";
import { ProviderLinkButtons } from "../../features/account-links/components/provider-link-buttons";
import { ServiceHintsDialog } from "../../features/account-links/components/service-hints-dialog";
import { UnlinkDialog } from "../../features/account-links/components/unlink-dialog";
import { VisibilityTable } from "../../features/account-links/components/visibility-table";
import { useAccountLinks } from "../../features/account-links/hooks/use-account-links";
import { useActiveUser } from "../../features/account-links/hooks/use-active-user";
import { useConsentRequest } from "../../features/account-links/hooks/use-consent-request";
import { useExternalUrlForm } from "../../features/account-links/hooks/use-external-url-form";
import { useProviderLink } from "../../features/account-links/hooks/use-provider-link";
import { useUnlink } from "../../features/account-links/hooks/use-unlink";
import { accountLinksMessages } from "../../features/account-links/messages";
import { ErrorNotice, LoadingState, SuccessNotice } from "../../features/app-shell/components/status-messages";
import { UnsavedChangesDialog } from "../../features/app-shell/components/unsaved-changes-dialog";
import { useUnsavedChangesGuard } from "../../features/app-shell/hooks/use-unsaved-changes-guard";
import { useMessages } from "../../lib/i18n/i18n-provider";
import type { RawSearch } from "../../lib/search-params";

/**
 * 「アカウント連携」画面。
 * OAuth Providerの`consentPage`を兼ね、署名付きクエリがあれば同意画面モードで表示する。
 * 署名付きクエリを保つため、クエリはすべてそのまま残す。
 * OAuth Providerの`consentPage`（IDの無い`/account-links`）で開いた場合も、クエリを保って現在のユーザーのID付きの経路へ移る（`UserScopeGate`）。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */
export const Route = createFileRoute("/{-$accountsUserId}/account-links")({
  validateSearch: (search: Record<string, unknown>) => search as RawSearch,
  component: AccountLinksPage,
});

function AccountLinksPage() {
  const messages = useMessages(accountLinksMessages);
  const search = Route.useSearch();
  const consent = useConsentRequest(search);
  const consentClientId = consent.request?.clientId;
  const accountLinks = useAccountLinks(consentClientId);
  const urlForm = useExternalUrlForm({ onSaved: accountLinks.reload });
  const unlink = useUnlink({ onUnlinked: accountLinks.reload });
  const pathname = useLocation({ select: (location) => location.pathname });
  const providerLink = useProviderLink(pathname);
  const activeUser = useActiveUser(consentClientId !== undefined);
  // 同意画面から戻る間は外部へ移動するため、未保存の確認を出さない。
  const guard = useUnsavedChangesGuard((accountLinks.table?.isDirty ?? false) && !consent.isSubmitting);

  const { links, table, loadState } = accountLinks;
  const consentClient = links?.clients.find((client) => client.clientId === consentClientId) ?? null;
  const tableWithConsent = consentClientId === undefined ? null : accountLinks.tableWithForcedConsent(consentClientId);
  const canAccept =
    tableWithConsent?.columns.every((column) => !column.lacksVerifiedSelection) === true &&
    accountLinks.saveState.status !== "saving";
  const urlCount =
    links?.accounts.reduce(
      (count, account) => count + account.identifiers.filter((identifier) => identifier.type === "url").length,
      0,
    ) ?? 0;
  const callbackError = typeof search.error === "string" ? search.error : null;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-2xl font-semibold">{messages.title}</h1>
        <Link to="/{-$accountsUserId}/help" hash="account-links" className="text-sm underline">
          {messages.helpLink}
        </Link>
      </header>

      {consent.request === null ? null : (
        <ConsentPanel
          request={consent.request}
          client={consentClient}
          isListReady={links !== null}
          activeUser={activeUser}
          isExpired={consent.isExpired}
          hasFailed={consent.hasFailed}
          isSubmitting={consent.isSubmitting}
          canAccept={canAccept}
          onAccept={() => void consent.accept(() => accountLinks.save(consentClientId))}
          onDeny={() => void consent.deny()}
        />
      )}

      {loadState.status === "loading" ? <LoadingState /> : null}
      {loadState.status === "error" ? <ErrorNotice error={loadState.error} /> : null}

      {links === null || table === null ? null : (
        <>
          <Card>
            <Card.Header>
              <Card.Title>{messages.urlFormTitle}</Card.Title>
            </Card.Header>
            <Card.Content className="flex flex-col gap-4">
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
              <div>
                <ServiceHintsDialog />
              </div>
              {consent.request === null ? (
                <ProviderLinkButtons
                  pendingProvider={providerLink.pendingProvider}
                  hasStartFailed={providerLink.error !== null}
                  callbackError={callbackError}
                  onLink={(provider) => void providerLink.link(provider)}
                />
              ) : null}
            </Card.Content>
          </Card>

          {unlink.isDone ? <SuccessNotice>{messages.unlinked}</SuccessNotice> : null}

          <VisibilityTable
            table={table}
            saveState={accountLinks.saveState}
            onAccountPublicChange={accountLinks.setAccountPublic}
            onClientConsentChange={accountLinks.setClientConsent}
            onClientVisibilityChange={accountLinks.setClientVisibility}
            onAccountVisibilityForAllClientsChange={accountLinks.setAccountVisibilityForAllClients}
            onSave={() => void accountLinks.save()}
            onDiscard={accountLinks.discardEdits}
            onRequestUnlinkAccount={(account) => unlink.request({ kind: "account", account })}
            onRequestUnlinkOAuth={(account, authAccountId) => unlink.request({ kind: "oauth", account, authAccountId })}
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
    </main>
  );
}
