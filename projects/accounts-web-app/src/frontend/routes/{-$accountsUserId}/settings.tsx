import { createFileRoute } from "@tanstack/react-router";

import { SettingsPage } from "../../features/settings/components/settings-page";

/**
 * 「その他」画面（`/{accountsUserId}/settings`）。
 * 言語・テーマはログインしていなくても選べるため、未ログインでも表示する。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */
export const Route = createFileRoute("/{-$accountsUserId}/settings")({
  staticData: { allowsGuest: true },
  component: SettingsPage,
});
