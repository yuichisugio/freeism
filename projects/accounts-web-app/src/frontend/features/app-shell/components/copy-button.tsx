import { Button } from "@heroui/react";

import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { useCopyText } from "../../../lib/use-copy-text";

/**
 * 文字列をコピーするボタン。
 * 結果は`role="status"`のテキストで読み上げる。
 */
export function CopyButton({ text, label }: { text: string; label?: string }) {
  const common = useMessages(commonMessages);
  const { status, copy } = useCopyText();
  return (
    <span className="inline-flex items-center gap-2">
      <Button size="sm" variant="outline" onPress={() => void copy(text)}>
        {label ?? common.copy}
      </Button>
      <span role="status" className="text-sm text-muted">
        {status === "copied" ? common.copied : status === "failed" ? common.copyFailed : ""}
      </span>
    </span>
  );
}
