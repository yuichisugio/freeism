import { createFileRoute } from "@tanstack/react-router";

import { OperationPage } from "../client/components/operation-page";
import { ProfileSettingsForm } from "../client/components/profile/profile-settings-form";

export const Route = createFileRoute("/settings/profile")({ component: ProfileSettingsPage });

export function ProfileSettingsPage() {
  return (
    <OperationPage
      description="プロフィール、公式Packageの表示順、評価軸ごとの公開範囲を管理します。"
      eyebrow="Settings"
      title="プロフィール設定"
    >
      <ProfileSettingsForm />
    </OperationPage>
  );
}
