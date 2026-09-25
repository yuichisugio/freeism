import { Button } from "@heroui/react";
import { useId } from "react";

import type { OAuthClientDetail } from "../../../../shared/schemas/oauth-client-schema";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import type { EditTarget } from "../hooks/use-oauth-clients";
import { developerMessages } from "../messages";

/**
 * 本人のOAuthクライアントの一覧と「新規登録」。
 * 選択中のクライアントは`aria-pressed`で示す。
 */
export function OAuthClientList({
  clients,
  editTarget,
  canCreate,
  onSelect,
  onCreate,
}: {
  clients: OAuthClientDetail[];
  editTarget: EditTarget | null;
  canCreate: boolean;
  onSelect: (client: OAuthClientDetail) => void;
  onCreate: () => void;
}) {
  const messages = useMessages(developerMessages);
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2 id={headingId} className="text-lg font-semibold">
        {messages.clientListTitle}
      </h2>
      {clients.length === 0 ? (
        <p className="text-sm text-muted">{messages.noClients}</p>
      ) : (
        <ul className="space-y-1">
          {clients.map((client) => {
            const isSelected = editTarget?.kind === "existing" && editTarget.client.clientId === client.clientId;
            return (
              <li key={client.clientId}>
                <Button
                  fullWidth
                  className="justify-start"
                  variant={isSelected ? "secondary" : "ghost"}
                  aria-pressed={isSelected}
                  onPress={() => onSelect(client)}
                >
                  {client.name}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <Button
        variant="outline"
        aria-pressed={editTarget?.kind === "new"}
        isDisabled={!canCreate}
        onPress={onCreate}
      >
        {messages.createClient}
      </Button>
      {canCreate ? null : <p className="text-sm text-muted">{messages.clientLimitReached}</p>}
    </section>
  );
}
