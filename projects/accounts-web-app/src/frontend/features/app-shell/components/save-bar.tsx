import { Button, Chip } from "@heroui/react";

import { useMessages } from "../../../lib/i18n/i18n-provider";
import { appShellMessages } from "../messages";

/**
 * 常に表示する保存バー。
 * 画面の下端に追従し、左に未保存の件数（0件なら「未保存の変更なし」）、右に「破棄」と保存を置く。
 * 狭い幅でも折り返さず1行に並べ、640px未満は横幅いっぱいにして、状態の文字を小さくし、間隔・左の余白・ボタンの左右の余白を詰める。
 * 横幅いっぱいのときも中身は右に寄せ、状態と「破棄」の間隔をボタン同士の間隔と同じにする。
 * 変更が0件のときは「破棄」と保存を無効にし、保存できない入力があるとき（`isSaveDisabled`）は保存だけを無効にする。
 * 画面に1つだけ置く。
 * @see ../../../../../docs/specification/v0.1/design-system/design-system.ja.md
 * @see ./save-bar.test.tsx
 */
export function SaveBar({
  dirtyCount,
  saveLabel,
  isSaving = false,
  isSaveDisabled = false,
  onDiscard,
  onSave,
}: {
  dirtyCount: number;
  saveLabel: string;
  isSaving?: boolean;
  isSaveDisabled?: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const messages = useMessages(appShellMessages);
  const hasChanges = dirtyCount > 0;
  return (
    <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 self-end rounded-full border border-border bg-surface py-2 pr-2 pl-4 shadow-overlay max-sm:gap-1 max-sm:self-stretch max-sm:rounded-xl max-sm:pl-3">
      <span role="status" className="min-w-0 truncate">
        {hasChanges ? (
          <Chip className="bg-highlight text-highlight-foreground tabular-nums">{messages.unsavedCount(dirtyCount)}</Chip>
        ) : (
          <span className="text-sm text-muted max-sm:text-xs">{messages.noUnsavedChanges}</span>
        )}
      </span>
      <Button size="sm" variant="ghost" className="shrink-0 max-sm:px-3" isDisabled={!hasChanges || isSaving} onPress={onDiscard}>
        {messages.discard}
      </Button>
      <Button
        size="sm"
        variant="primary"
        className="shrink-0 max-sm:px-3"
        isDisabled={!hasChanges || isSaveDisabled}
        isPending={isSaving}
        onPress={onSave}
      >
        {saveLabel}
      </Button>
    </div>
  );
}
