import { createFileRoute } from "@tanstack/react-router";

import { UnsavedChangesDialog } from "../features/app-shell/components/unsaved-changes-dialog";
import { useUnsavedChangesGuard } from "../features/app-shell/hooks/use-unsaved-changes-guard";
import { DeveloperPage } from "../features/developer/components/developer-page";
import { useOAuthClients } from "../features/developer/hooks/use-oauth-clients";
import { useResourceApiReference } from "../features/developer/hooks/use-resource-api-reference";

export const Route = createFileRoute("/developer")({
  component: DeveloperRoute,
});

/**
 * 「開発者向け」画面。
 * 未保存の変更がある状態で別画面へ移動する場合は確認を表示する。
 */
function DeveloperRoute() {
  const state = useOAuthClients();
  const resourceApiReference = useResourceApiReference();
  const guard = useUnsavedChangesGuard(state.isDirty);

  return (
    <>
      <DeveloperPage state={state} resourceApiReference={resourceApiReference} />
      <UnsavedChangesDialog
        isOpen={guard.isConfirming}
        onDiscard={guard.discardAndLeave}
        onKeepEditing={guard.keepEditing}
      />
    </>
  );
}
