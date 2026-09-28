import { Button, Checkbox, Chip } from "@heroui/react";
import type { ReactNode } from "react";

import type { LinkedAccount, LinkedClient } from "../../../../shared/schemas/account-link-schema";
import type { VerificationMethod } from "../../../../shared/schemas/verification-schema";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import type { RawSearch } from "../../../lib/search-params";
import { useHydratedSession } from "../../../lib/use-hydrated-session";
import { describeAccount, formatAccountLabel } from "../../account-links/lib/account-label";
import { CheckIcon, ExternalLinkIcon } from "../../app-shell/components/icons";
import { InfoMessage } from "../../app-shell/components/info-message";
import { ServiceFavicon } from "../../app-shell/components/service-favicon";
import { ErrorNotice, ErrorText, LoadingState } from "../../app-shell/components/status-messages";
import { useConsentRequest } from "../hooks/use-consent-request";
import type { ConsentRequest } from "../hooks/use-consent-request";
import { useConsentSelection } from "../hooks/use-consent-selection";
import type { BulkState, ConsentRow } from "../hooks/use-consent-selection";
import { consentMessages } from "../messages";

/**
 * 同意画面（OAuth Providerの`consentPage`）。
 * 中央の1枚のカードに、見出し・連携するアカウント・紹介ページと戻り先・利用目的・選択リスト・情報メッセージ・ボタンを上から並べる。
 * 選択リストは今回の連携先の列だけを選ばせ、「同意して戻る」でその列だけを保存してから標準の`oauth2.consent`を送る。
 * @see ../../../../../docs/specification/v0.1/design-system.ja.md
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./consent-page.test.tsx
 */
export function ConsentPage({ search }: { search: RawSearch }) {
  const messages = useMessages(consentMessages);
  const consent = useConsentRequest(search);

  return (
    <main className="mx-auto flex w-full max-w-(--page-max) flex-col px-6 pt-8 pb-10 max-sm:px-4 max-sm:pt-5 max-sm:pb-8">
      {consent.request === null ? (
        <ErrorText>{messages.requestMissing}</ErrorText>
      ) : (
        <ConsentCard request={consent.request} consent={consent} />
      )}
    </main>
  );
}

// --------------------------------------------------
// カード
// --------------------------------------------------

/**
 * 認可要求1件の同意のカード。
 * 一覧の取得後に描画し、連携先の名前が決まる前の表示を出さない。
 */
function ConsentCard({
  request,
  consent,
}: {
  request: ConsentRequest;
  consent: ReturnType<typeof useConsentRequest>;
}) {
  const messages = useMessages(consentMessages);
  const selection = useConsentSelection(request.clientId);
  const session = useHydratedSession();
  const user = session.data?.user;

  if (selection.loadState.status === "loading") return <LoadingState />;
  if (selection.loadState.status === "error") return <ErrorNotice error={selection.loadState.error} />;

  const { client } = selection;
  const clientName = client?.name ?? request.clientId;
  const blockedMessage = consent.isExpired
    ? messages.expired
    : consent.hasFailed
      ? messages.failed
      : client === null
        ? messages.clientMissing
        : null;

  return (
    <section
      aria-labelledby="consent-title"
      className="mx-auto flex w-full max-w-(--consent-w) flex-col gap-5 rounded-xl border border-border bg-surface px-6 py-5 shadow-surface max-sm:p-4"
    >
      <div className="flex flex-col gap-3">
        <h1 id="consent-title" className="text-xl">
          {messages.title(clientName)}
        </h1>
        {user === undefined ? null : (
          <p className="flex flex-col gap-1 text-sm">
            <span className="text-muted">{messages.activeUser}</span>
            <span className="wrap-anywhere">
              {user.name} ({user.id})
            </span>
          </p>
        )}
      </div>
      <ClientDetails client={client} redirectHost={request.redirectHost} />
      <p className="text-sm">
        {messages.purpose.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </p>
      {blockedMessage === null ? null : <ErrorText>{blockedMessage}</ErrorText>}
      <ConsentAccountList
        clientName={clientName}
        rows={selection.rows}
        bulkState={selection.bulkState}
        onSelectedChange={selection.setSelected}
        onAllSelectedChange={selection.setAllSelected}
      />
      {blockedMessage === null && !selection.hasVerifiedSelection ? (
        <InfoMessage>{messages.selectionRequired(clientName)}</InfoMessage>
      ) : null}
      {selection.saveError === null ? null : <ErrorNotice error={selection.saveError} />}
      {consent.isRejected ? <ErrorText>{messages.rejected}</ErrorText> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="ghost"
          isDisabled={consent.isExpired || consent.hasFailed || consent.isSubmitting}
          onPress={() => void consent.deny()}
        >
          {messages.deny}
        </Button>
        <Button
          variant="primary"
          isDisabled={blockedMessage !== null || !selection.hasVerifiedSelection || consent.isSubmitting}
          onPress={() => void consent.accept(selection.save)}
        >
          {messages.accept}
        </Button>
      </div>
    </section>
  );
}

/**
 * 紹介ページと戻り先。
 * ラベルの下の行に値を置く。
 */
function ClientDetails({ client, redirectHost }: { client: LinkedClient | null; redirectHost: string | null }) {
  const messages = useMessages(consentMessages);
  if (client?.uri == null && redirectHost === null) return null;

  return (
    <dl className="grid gap-1 text-sm [&_dd]:wrap-anywhere [&_dd+dt]:mt-2 [&_dt]:text-muted">
      {client?.uri == null ? null : (
        <>
          <dt>{messages.serviceUrl}</dt>
          <dd>
            <a href={client.uri} target="_blank" rel="noopener noreferrer">
              {client.uri}
              <ExternalLinkIcon className="ml-1 inline-block size-4 align-[-2px]" />
              <span className="sr-only">{messages.opensInNewTab}</span>
            </a>
          </dd>
        </>
      )}
      {redirectHost === null ? null : (
        <>
          <dt>{messages.redirectHost}</dt>
          <dd className="font-mono">{redirectHost}</dd>
        </>
      )}
    </dl>
  );
}

// --------------------------------------------------
// 選択リスト
// --------------------------------------------------

/**
 * 今回の連携先の列だけの選択リスト。
 * 見出し行に「アカウント」と一括チェック（未検証の行を含む全行が対象）、各行にアイコン・「サービス名：識別子」・チップ・右端のチェックを置く。
 * 行全体を押してもチェックを切り替えられる。
 */
function ConsentAccountList({
  clientName,
  rows,
  bulkState,
  onSelectedChange,
  onAllSelectedChange,
}: {
  clientName: string;
  rows: readonly ConsentRow[];
  bulkState: BulkState;
  onSelectedChange: (accountId: string, isSelected: boolean) => void;
  onAllSelectedChange: (isSelected: boolean) => void;
}) {
  const messages = useMessages(consentMessages);

  return (
    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      <li className="bg-surface-secondary">
        <PickRow
          label={messages.bulkLabel(clientName)}
          isSelected={bulkState === "all"}
          isIndeterminate={bulkState === "some"}
          isDisabled={bulkState === "empty"}
          onChange={onAllSelectedChange}
          className="py-2 text-sm font-medium"
        >
          <span className="flex-1">{messages.listHeading}</span>
        </PickRow>
      </li>
      {rows.map(({ account, isSelected }) => {
        // 行の表示は「アカウント連携」画面の表と揃える。
        const accountLabel = formatAccountLabel(account, messages.accountSeparator);
        const { iconHost } = describeAccount(account);
        return (
          <li key={account.id}>
            <PickRow
              label={messages.rowLabel(accountLabel, clientName)}
              isSelected={isSelected}
              onChange={(next) => onSelectedChange(account.id, next)}
              className="min-h-16 py-3"
            >
              {iconHost === undefined ? null : <ServiceFavicon host={iconHost} />}
              <span className="flex min-w-0 flex-1 flex-col gap-1 leading-tight">
                <span className="text-md font-medium wrap-anywhere">{accountLabel}</span>
                <span className="flex flex-wrap items-center gap-1">
                  {account.verificationStatus === "verified" ? (
                    listVerifiedMethods(account).map((method) => (
                      <Chip key={method} color="success" variant="soft">
                        <CheckIcon className="size-3" />
                        {messages.methods[method]}
                      </Chip>
                    ))
                  ) : (
                    <Chip color="default" variant="soft">
                      {messages.unverified}
                    </Chip>
                  )}
                </span>
              </span>
            </PickRow>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * チップを並べる順（OAuth・双方向リンク・DNS TXT）。
 */
const methodOrder: readonly VerificationMethod[] = ["oauth", "bidirectional_link", "dns_txt"];

/**
 * 成功した証明方法（重複を除き、決まった順に並べる）。
 */
function listVerifiedMethods(account: LinkedAccount): VerificationMethod[] {
  return methodOrder.filter((method) => account.verifications.some((verification) => verification.method === method));
}

/**
 * 選択リストの1行。
 * 行全体をチェックボックスのラベルにし、チェックを右端に置く。
 */
function PickRow({
  label,
  isSelected,
  isIndeterminate,
  isDisabled,
  onChange,
  className,
  children,
}: {
  label: string;
  isSelected: boolean;
  isIndeterminate?: boolean;
  isDisabled?: boolean;
  onChange: (isSelected: boolean) => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <Checkbox
      aria-label={label}
      isSelected={isSelected}
      isIndeterminate={isIndeterminate}
      isDisabled={isDisabled}
      onChange={onChange}
      className="w-full"
    >
      <Checkbox.Content className={`flex w-full items-center gap-3 px-4 ${className}`}>
        {children}
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
}
