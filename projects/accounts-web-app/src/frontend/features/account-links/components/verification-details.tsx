import { Chip } from "@heroui/react";

import type { VerificationAttempt } from "../../../../shared/schemas/external-url-schema";
import type { VerificationResult } from "../../../../shared/schemas/verification-schema";
import { AlertIcon, CheckIcon, InfoIcon } from "../../app-shell/components/icons";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { accountLinksMessages } from "../messages";

const resultChips = {
  verified: { color: "success", Icon: CheckIcon },
  not_verified: { color: "warning", Icon: AlertIcon },
  indeterminate: { color: "default", Icon: InfoIcon },
} as const satisfies Record<VerificationResult, { color: "success" | "warning" | "default"; Icon: typeof CheckIcon }>;

/**
 * 試行結果のチップ（「{方法}: {結果}」）。
 * 色だけでなくアイコンと結果の文言で区別する。
 */
export function VerificationResultChip({ label, result }: { label: string; result: VerificationResult }) {
  const messages = useMessages(accountLinksMessages);
  const { color, Icon } = resultChips[result];
  return (
    <Chip color={color} variant="soft">
      <Icon className="size-3" />
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
    <div className="flex flex-col items-start gap-1">
      <VerificationResultChip label={label} result={attempt.result} />
      {attempt.failureCode === null ? null : <p className="text-muted">{messages.failureGuidance[attempt.failureCode]}</p>}
    </div>
  );
}
