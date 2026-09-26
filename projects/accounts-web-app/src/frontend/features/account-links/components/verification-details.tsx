import { Chip } from "@heroui/react";

import type { LinkedVerification } from "../../../../shared/schemas/account-link-schema";
import type { VerificationAttempt } from "../../../../shared/schemas/external-url-schema";
import type { VerificationResult } from "../../../../shared/schemas/verification-schema";
import { formatDateTime } from "../../../lib/i18n/format";
import { useI18n, useMessages } from "../../../lib/i18n/i18n-provider";
import { accountLinksMessages } from "../messages";

const resultColors = {
  verified: "success",
  not_verified: "warning",
  indeterminate: "default",
} as const satisfies Record<VerificationResult, "success" | "warning" | "default">;

/**
 * 試行結果のテキスト付きバッジ。
 * 色だけでなく方法名と結果の文言で区別する。
 */
export function VerificationBadge({ label, result }: { label: string; result: VerificationResult }) {
  const messages = useMessages(accountLinksMessages);
  return (
    <Chip size="sm" color={resultColors[result]}>
      {`${label}: ${messages.results[result]}`}
    </Chip>
  );
}

/**
 * 1つの方法の試行結果と、`failure_code`から導く次の操作の案内。
 */
export function AttemptResult({ label, attempt }: { label: string; attempt: VerificationAttempt }) {
  const messages = useMessages(accountLinksMessages);
  return (
    <div className="flex flex-col gap-1">
      <VerificationBadge label={label} result={attempt.result} />
      {attempt.failureCode === null ? null : (
        <p className="text-sm">{messages.failureGuidance[attempt.failureCode]}</p>
      )}
    </div>
  );
}

/**
 * 外部アカウントの証明方法ごとの結果・日時・証拠URL・案内。
 * 成功した証明の日時と、直近の試行の結果を分けて示す。
 */
export function VerificationList({ verifications }: { verifications: LinkedVerification[] }) {
  const messages = useMessages(accountLinksMessages);
  const { language } = useI18n();
  if (verifications.length === 0) return <p className="text-sm text-muted">{messages.noVerification}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {verifications.map((verification) => (
        <li key={verification.id} className="flex flex-col gap-1">
          <AttemptResult label={messages.methods[verification.method]} attempt={verification} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-xs text-muted">
            {verification.verifiedAt === null ? null : (
              <>
                <dt>{messages.verifiedAt}</dt>
                <dd>{formatDateTime(verification.verifiedAt, language)}</dd>
              </>
            )}
            <dt>{messages.checkedAt}</dt>
            <dd>{formatDateTime(verification.checkedAt, language)}</dd>
            {verification.evidenceUrl === null ? null : (
              <>
                <dt>{messages.evidenceUrl}</dt>
                <dd className="break-all">{verification.evidenceUrl}</dd>
              </>
            )}
          </dl>
        </li>
      ))}
    </ul>
  );
}
