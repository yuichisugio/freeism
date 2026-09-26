import { Alert } from "@heroui/react";

import { useMessages } from "../../../lib/i18n/i18n-provider";
import { authMessages } from "../messages";

/**
 * ログイン失敗時に戻された`?error=`の案内。
 * `account_not_linked`と`email_not_found`は次の操作を案内し、それ以外は汎用の失敗として示す。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 */
export function LoginErrorNotice({ errorCode }: { errorCode: string }) {
  const messages = useMessages(authMessages);
  const { title, descriptions } = describeLoginError(errorCode, messages);
  return (
    <Alert status="danger" role="alert">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        {descriptions.map((description) => (
          <Alert.Description key={description}>{description}</Alert.Description>
        ))}
      </Alert.Content>
    </Alert>
  );
}

/**
 * エラーコードから見出しと案内文を選ぶ。
 */
function describeLoginError(
  errorCode: string,
  messages: (typeof authMessages)["ja"],
): { title: string; descriptions: string[] } {
  switch (errorCode) {
    case "account_not_linked":
      return {
        title: messages.accountNotLinkedTitle,
        descriptions: [messages.accountNotLinkedDescription, messages.accountNotLinkedMovedDescription],
      };
    case "email_not_found":
      return { title: messages.emailNotFoundTitle, descriptions: [messages.emailNotFoundDescription] };
    default:
      return { title: messages.unknownErrorTitle, descriptions: [messages.unknownErrorDescription(errorCode)] };
  }
}
