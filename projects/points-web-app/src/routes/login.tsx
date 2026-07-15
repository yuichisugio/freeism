import { createFileRoute } from "@tanstack/react-router";

import { ProviderButtons } from "../client/components/auth/provider-buttons";
import { OperationPage } from "../client/components/operation-page";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

export function LoginPage() {
  return (
    <OperationPage
      description="Pointsの本人確認に使うProviderを選択してください。メールアドレス一致による暗黙連携は行いません。"
      eyebrow="Authentication"
      title="ログイン"
    >
      <section className="form-card">
        <h2>Providerを選択</h2>
        <ProviderButtons mode="login" />
      </section>
    </OperationPage>
  );
}
