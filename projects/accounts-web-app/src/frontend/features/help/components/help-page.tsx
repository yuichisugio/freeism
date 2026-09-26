import { useMessages } from "../../../lib/i18n/i18n-provider";
import { DocumentPage } from "../../app-shell/components/document-page";
import { helpMessages } from "../messages";

/**
 * 公開ヘルプ（`/help`）。
 * ログインせずに閲覧でき、画面の使い方と、各Providerでの連携許可の取消方法を案内する。
 * 保存する情報と公開・提供の扱いはプライバシーポリシー（`/privacy`）で説明する。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./help-page.test.tsx
 */
export function HelpPage() {
  const messages = useMessages(helpMessages);
  return <DocumentPage title={messages.title} introduction={messages.introduction} sections={messages.sections} />;
}
