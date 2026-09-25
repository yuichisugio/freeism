import { Button, FieldError, Input, Label, TextField } from "@heroui/react";

import { urlIdentifierLimitPerUser } from "../../../../shared/constants";
import type { ExternalUrlMode } from "../../../../shared/schemas/external-url-schema";
import { ErrorNotice, ErrorText, SuccessNotice } from "../../app-shell/components/status-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import type { ExternalUrlOutcome, UrlValidationError } from "../hooks/use-external-url-form";
import { accountLinksMessages } from "../messages";
import { AttemptResult } from "./verification-details";

/**
 * 外部URLの入力欄と「保存して検証する」「未検証で保存」。
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
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit("verify");
      }}
    >
      <TextField
        value={url}
        onChange={onUrlChange}
        validationBehavior="aria"
        isInvalid={validationMessage !== undefined || serverInputErrorMessage !== undefined} isDisabled={isSubmitting}>
        <Label>{messages.urlLabel}</Label>
        <Input type="url" inputMode="url" placeholder={messages.urlPlaceholder} />
        <FieldError>{validationMessage}</FieldError>
      </TextField>
      <p className="text-sm text-muted">{messages.urlCount(urlCount, urlIdentifierLimitPerUser)}</p>
      {isLimitReached ? <p className="text-sm">{messages.urlLimitReached}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" isDisabled={isSubmitting}>
          {submittingMode === "verify" ? messages.verifying : messages.verifyUrl}
        </Button>
        <Button variant="secondary" isDisabled={isSubmitting} onPress={() => onSubmit("unverified")}>
          {messages.saveUnverifiedUrl}
        </Button>
      </div>
      {serverInputErrorMessage !== undefined ? (
        <ErrorText>{serverInputErrorMessage}</ErrorText>
      ) : error !== null ? (
        <ErrorNotice error={error} codeMessages={messages.errorCodes} />
      ) : null}
      {outcome === null ? null : <ExternalUrlOutcomeView outcome={outcome} />}
    </form>
  );
}

/**
 * 保存・検証の結果。
 * リンク確認とDNS TXTの方法別の結果と、次の操作の案内を示す。
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
    result.status !== "verified"
      ? messages.verifyFailed
      : isAttemptVerified
        ? messages.verifySucceeded
        : messages.reverifyFailedKeptExisting;
  return (
    <div role="status" className="flex flex-col gap-2 rounded border border-default p-3">
      <p className="font-semibold">{summary}</p>
      <AttemptResult label={messages.linkAttempt} attempt={result.link} />
      {result.link.evidenceUrl === null ? null : (
        <p className="break-all text-sm">
          {messages.evidenceUrl}: {result.link.evidenceUrl}
        </p>
      )}
      {result.dns === null ? null : <AttemptResult label={messages.dnsAttempt} attempt={result.dns} />}
    </div>
  );
}
