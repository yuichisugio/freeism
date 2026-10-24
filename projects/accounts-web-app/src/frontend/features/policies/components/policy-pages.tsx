import { useMessages } from "../../../lib/i18n/i18n-provider";
import { DocumentPage } from "../../app-shell/components/document-page";
import { privacyPolicyMessages, termsOfUseMessages } from "../messages";

/**
 * プライバシーポリシー（`/privacy`）。
 * ログインせずに閲覧できる。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./policy-pages.test.tsx
 */
export function PrivacyPolicyPage() {
  const messages = useMessages(privacyPolicyMessages);
  return <DocumentPage title={messages.title} introduction={messages.introduction} sections={messages.sections} />;
}

/**
 * 利用規約（`/terms`）。
 * ログインせずに閲覧できる。
 * @see ./policy-pages.test.tsx
 */
export function TermsOfUsePage() {
  const messages = useMessages(termsOfUseMessages);
  return <DocumentPage title={messages.title} introduction={messages.introduction} sections={messages.sections} />;
}
