import { Alert, Spinner } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { describeError, isUnauthorizedError } from "../../../lib/describe-error";
import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";

/**
 * 読み込み中の表示。
 * スクリーンリーダーには`role="status"`で読み上げる。
 */
export function LoadingState({ label }: { label?: string }) {
  const common = useMessages(commonMessages);
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-muted">
      <Spinner size="sm" aria-hidden="true" />
      <span>{label ?? common.loading}</span>
    </div>
  );
}

/**
 * 失敗の表示。
 * `role="alert"`で読み上げ、ログインしていない場合はログイン画面への案内を添える。
 */
export function ErrorNotice({
  error,
  codeMessages,
  title,
}: {
  error: unknown;
  codeMessages?: Partial<Record<string, string>>;
  title?: string;
}) {
  const common = useMessages(commonMessages);
  const message = describeError(error, common, codeMessages);
  return (
    <Alert status="danger" role="alert">
      <Alert.Indicator />
      <Alert.Content>
        {title === undefined ? null : <Alert.Title>{title}</Alert.Title>}
        <Alert.Description>
          {message}
          {isUnauthorizedError(error) ? (
            <>
              {" "}
              <Link to="/" className="underline">
                {common.goToLogin}
              </Link>
            </>
          ) : null}
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

/**
 * 利用者向けの文言をそのまま示す失敗の表示（入力不備など）。
 */
export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <Alert status="danger" role="alert">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{children}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

/**
 * 成功の通知。
 * `role="status"`で読み上げる。
 */
export function SuccessNotice({ children }: { children: string }) {
  return (
    <Alert status="success" role="status">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{children}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
