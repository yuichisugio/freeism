import { Card } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

/**
 * Accountsのトップ画面。
 */
function HomePage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-8">
      <Card>
        <Card.Header>
          <Card.Title>Accounts</Card.Title>
          <Card.Description>外部アカウントの所有権証明と公開先ごとの情報提供を管理します。</Card.Description>
        </Card.Header>
      </Card>
    </main>
  );
}
