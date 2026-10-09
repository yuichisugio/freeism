import { Button } from "@heroui/react";

import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { ErrorNotice, LoadingState } from "../../app-shell/components/status-messages";

/**
 * 画面表示時の読み込み中・失敗の表示。
 * 失敗時は再読み込みの操作を添える。
 */
export function LoadStatus({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const common = useMessages(commonMessages);
  if (error === null) return <LoadingState />;
  return (
    <div className="space-y-2">
      <ErrorNotice error={error} />
      <Button size="sm" variant="outline" onPress={onRetry}>
        {common.retry}
      </Button>
    </div>
  );
}
