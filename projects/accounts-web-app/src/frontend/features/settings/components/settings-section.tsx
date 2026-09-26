import { Card } from "@heroui/react";
import type { ReactNode } from "react";

/**
 * 「設定」画面の1機能分の枠。
 */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>{title}</Card.Title>
        <Card.Description>{description}</Card.Description>
      </Card.Header>
      <Card.Content className="space-y-4">{children}</Card.Content>
    </Card>
  );
}
