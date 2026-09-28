import { Button, Card, FieldError, Input, TextField } from "@heroui/react";
import { Link } from "@tanstack/react-router";

import { urlIdentifierLimitPerUser } from "../../../../shared/constants";
import type { ExternalUrlMode } from "../../../../shared/schemas/external-url-schema";
import { ErrorNotice, ErrorText, SuccessNotice } from "../../app-shell/components/status-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import type { ExternalUrlOutcome, UrlValidationError } from "../hooks/use-external-url-form";
import { accountLinksMessages } from "../messages";
import { AttemptResult } from "./verification-details";

/**
 * 「URLで証明」カード。
 * 手順・登録済みのURLの件数・URLの入力欄と「検証する」「未検証で保存」・使い方への案内を置き、検証の結果を入力欄の下に示す。
 * @see ../../../../../docs/specification/v0.1/design-system.ja.md
 * @see ../../../../../docs/specification/v0.1/verify-url.ja.md
 */
export function ExternalUrlForm({
  url,
  onUrlChange,
  validationError,
  submittingMode,
  onSubmit,
  outcome,
  error,
  urlInputErrorCode,
  urlCount,
}: {
  url: string;
  onUrlChange: (url: string) => void;
  validationError: UrlValidationError | null;
  submittingMode: ExternalUrlMode | null;
  onSubmit: (mode: ExternalUrlMode) => void;
  outcome: ExternalUrlOutcome | null;
  error: unknown;
  urlInputErrorCode: string | null;
  urlCount: number;
}) {
  const messages = useMessages(accountLinksMessages);
  const isSubmitting = submittingMode !== null;
  const isLimitReached = urlCount >= urlIdentifierLimitPerUser;
  const validationMessage =
    validationError === "required" ? messages.urlRequired : validationError === "tooLong" ? messages.urlTooLong : undefined;
  // バックエンドが返したURLの不備は、送信後に読み上げるためalertで示す。
  const serverInputErrorMessage = urlInputErrorCode === null ? undefined : messages.urlInputErrors[urlInputErrorCode];

  return (
    <Card className="gap-4">
      <Card.Header className="flex flex-row flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg">{messages.urlProofTitle}</h2>
        <span className="text-xs text-muted tabular-nums">{messages.urlCount(urlCount, urlIdentifierLimitPerUser)}</span>
      </Card.Header>
      <Card.Content>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit("verify");
          }}
        >
          <ol className="flex list-decimal flex-col gap-0.5 pl-5 text-sm">
            {messages.urlProofSteps.map((step) => (
              <li key={step.before + step.strong}>
                {step.before}
                {step.strong === "" ? null : <strong>{step.strong}</strong>}
                {step.after}
              </li>
            ))}
          </ol>
          {isLimitReached ? <p className="text-sm">{messages.urlLimitReached}</p> : null}
          <div className="flex flex-wrap items-start gap-2">
            <TextField
              aria-label={messages.urlLabel}
              value={url}
              onChange={onUrlChange}
              validationBehavior="aria"
              isInvalid={validationMessage !== undefined || serverInputErrorMessage !== undefined}
              isDisabled={isSubmitting}
              className="min-w-0 flex-[1_1_240px]"
            >
              {/* スキームの無い入力もブラウザー標準の型検査で送信を止めず、アプリの検査で案内する。 */}
              <Input type="text" inputMode="url" placeholder={messages.urlPlaceholder} className="font-mono text-sm" />
              <FieldError>{validationMessage}</FieldError>
            </TextField>
            <Button type="submit" variant="primary" isDisabled={isSubmitting}>
              {submittingMode === "verify" ? messages.verifying : messages.verifyUrl}
            </Button>
            <Button variant="outline" isDisabled={isSubmitting} onPress={() => onSubmit("unverified")}>
              {messages.saveUnverifiedUrl}
            </Button>
          </div>
          {serverInputErrorMessage !== undefined ? (
            <ErrorText>{serverInputErrorMessage}</ErrorText>
          ) : error !== null ? (
            <ErrorNotice error={error} codeMessages={messages.errorCodes} />
          ) : null}
          {outcome === null ? null : <ExternalUrlOutcomeView outcome={outcome} />}
          <Link to="/{-$accountsUserId}/help" hash="url-verification" className="self-start text-xs">
            {messages.troubleLink}
          </Link>
        </form>
      </Card.Content>
    </Card>
  );
}

/**
 * 保存・検証の結果。
 * 双方向リンクとDNS TXTの方法別の結果と、次の操作の案内を示す。
 * 要約文は、保留（`indeterminate`）も失敗（`not_verified`）と同じにする。
 */
function ExternalUrlOutcomeView({ outcome }: { outcome: ExternalUrlOutcome }) {
  const messages = useMessages(accountLinksMessages);
  if (outcome.mode === "unverified") {
    return (
      <SuccessNotice>{outcome.result.created ? messages.unverifiedSaved : messages.unverifiedAlreadyRegistered}</SuccessNotice>
    );
  }
  const { result } = outcome;
  // 再検証で今回の試行がどちらも成立しなくても、既存の証明が有効なら紐付けは維持されている。
  const isAttemptVerified = result.link.result === "verified" || result.dns?.result === "verified";
  const summary =
    result.externalAccountId === null
      ? messages.verifyFailedNotSaved
      : result.status !== "verified"
        ? messages.verifyFailed
        : isAttemptVerified
          ? messages.verifySucceeded
          : messages.reverifyFailedKeptExisting;
  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
      <b className="font-bold">{summary}</b>
      <AttemptResult label={messages.methods.bidirectional_link} attempt={result.link} />
      {result.dns === null ? null : <AttemptResult label={messages.methods.dns_txt} attempt={result.dns} />}
      {result.link.evidenceUrl === null ? null : (
        <p className="text-muted">
          {messages.evidenceLabels.bidirectional_link}: <span className="font-mono break-all">{result.link.evidenceUrl}</span>
        </p>
      )}
    </div>
  );
}
