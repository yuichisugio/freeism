import { Alert } from "@heroui/react";
import type { ReactNode } from "react";

/**
 * 情報メッセージ（info トーン）。
 * エラーではない案内（公開先ごとに証明済みの選択が0件のときなど）に使い、主色の淡い面と情報アイコンで示す。
 * @see ../../../../../docs/specification/v0.1/design-system/design-system.ja.md
 */
export function InfoMessage({ children }: { children: ReactNode }) {
  return (
    <Alert status="accent" className="gap-2 py-2">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{children}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
