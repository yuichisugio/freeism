import { createFileRoute } from "@tanstack/react-router";

import { OAuthClientsPanel } from "../client/components/developer/oauth-clients-panel";
import { OperationPage } from "../client/components/operation-page";

export const Route = createFileRoute("/developer")({ component: DeveloperPage });

/** ログイン本人の OAuth クライアント管理画面。 */
export function DeveloperPage() {
  return (
    <OperationPage
      description="自分のアプリを OAuth クライアントとして登録し、接続情報と公開鍵を管理します。"
      eyebrow="Developer"
      title="開発者向け"
    >
      <OAuthClientsPanel />
    </OperationPage>
  );
}
