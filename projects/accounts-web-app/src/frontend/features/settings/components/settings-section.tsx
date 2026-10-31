import { Card } from "@heroui/react";
import { useId } from "react";
import type { ReactNode } from "react";

/**
 * 「その他」画面の設問カード（1つの設定・機能に1枚）。
 * 左列に見出しと説明、右列に操作を置き、640px以下は1列にする。
 * 退会のカードは枠と見出しを危険の色にする（`tone="danger"`）。
 * @see ../../../../../docs/specification/v0.1/design-system/design-system.ja.md
 */
export function SettingsSection({
  title,
  description,
  tone = "default",
  children,
}: {
  title: string;
  description?: string;
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  const titleId = useId();
  const isDanger = tone === "danger";
  return (
    <Card
      role="region"
      aria-labelledby={titleId}
      className={`grid grid-cols-[var(--q-label-w)_minmax(0,1fr)] gap-x-6 gap-y-3 max-sm:grid-cols-1 max-sm:px-5 ${isDanger ? "border-danger/40" : ""}`}
    >
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className={`font-display text-lg font-bold ${isDanger ? "text-danger" : ""}`}>
          {title}
        </h2>
        {description === undefined ? null : <p className="text-xs text-muted">{description}</p>}
      </div>
      <div className="flex min-w-0 flex-col items-start gap-3">{children}</div>
    </Card>
  );
}
