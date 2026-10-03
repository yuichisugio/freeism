import { InfoMessage } from "../../app-shell/components/info-message";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import type { VisibilityColumn } from "../lib/visibility-draft";
import { accountLinksMessages } from "../messages";

/**
 * 公開設定の表の下に置く情報メッセージ。
 * 保存済みの状態で証明済みの行の選択が0件の公開先ごとに、情報を提供しないこと（プロフィールは公開プロフィールを表示しないこと）を示す。
 * @see ../../../../../docs/specification/v0.1/design-system/design-system.ja.md
 */
export function UnpublishedMessages({ columns }: { columns: VisibilityColumn[] }) {
  const messages = useMessages(accountLinksMessages);
  const unpublished = columns.filter((column) => !column.isPublished);
  if (unpublished.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {unpublished.map(({ destination }) =>
        destination.kind === "profile" ? (
          <InfoMessage key="profile">{messages.unpublishedProfile}</InfoMessage>
        ) : (
          <InfoMessage key={destination.client.clientId}>{messages.unpublishedClient(destination.client.name)}</InfoMessage>
        ),
      )}
    </div>
  );
}
