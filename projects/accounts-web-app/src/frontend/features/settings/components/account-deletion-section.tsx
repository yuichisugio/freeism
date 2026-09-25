import { Button, Checkbox } from "@heroui/react";

import { useMessages } from "../../../lib/i18n/i18n-provider";
import { ErrorNotice } from "../../app-shell/components/status-messages";
import type { AccountDeletion } from "../hooks/use-account-deletion";
import { settingsMessages } from "../messages";
import { LoadStatus } from "./load-status";
import { SettingsSection } from "./settings-section";

/**
 * 退会の確認と実行。
 * 削除するデータと終了する登録OAuthクライアントを示し、「内容を確認した」のチェック後に実行できる。
 * @see ./settings-sections.test.tsx
 */
export function AccountDeletionSection({ accountDeletion }: { accountDeletion: AccountDeletion }) {
  const messages = useMessages(settingsMessages);
  const { clients } = accountDeletion;

  return (
    <SettingsSection title={messages.deletionTitle} description={messages.deletionDescription}>
      <section className="space-y-1">
        <h4 className="text-sm font-semibold">{messages.deletionTargetsTitle}</h4>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {messages.deletionTargets.map((target) => (
            <li key={target}>{target}</li>
          ))}
        </ul>
      </section>
      <section className="space-y-1">
        <h4 className="text-sm font-semibold">{messages.deletionClientsTitle}</h4>
        {clients === null ? (
          <LoadStatus error={accountDeletion.clientsError} onRetry={accountDeletion.reloadClients} />
        ) : clients.length === 0 ? (
          <p className="text-sm">{messages.deletionNoClients}</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {clients.map((client) => (
              <li key={client.clientId}>
                {client.name} <span className="text-muted">({client.clientId})</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Checkbox
        isSelected={accountDeletion.isConfirmed}
        onChange={accountDeletion.changeConfirmed}
        isDisabled={accountDeletion.isDeleting}
      >
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          {messages.deletionConfirm}
        </Checkbox.Content>
      </Checkbox>
      <Button
        variant="danger"
        isDisabled={!accountDeletion.canDelete}
        onPress={() => void accountDeletion.deleteAccount()}
      >
        {accountDeletion.isDeleting ? messages.deleting : messages.deletionButton}
      </Button>
      {accountDeletion.deleteError === null ? null : <ErrorNotice error={accountDeletion.deleteError} />}
    </SettingsSection>
  );
}
