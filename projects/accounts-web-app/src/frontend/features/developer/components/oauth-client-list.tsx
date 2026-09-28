import { Button } from "@heroui/react";

import type { OAuthClientDetail } from "../../../../shared/schemas/oauth-client-schema";
import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { useCopyText } from "../../../lib/use-copy-text";
import { CopyIcon } from "../../app-shell/components/icons";
import type { EditTarget } from "../hooks/use-oauth-clients";
import { developerMessages } from "../messages";

/**
 * 本人のOAuthクライアントの一覧（アプリ名・Client ID・「編集」「削除」）。
 * 編集中の行は主色の淡い面にする。
 * @see ./developer-section.test.tsx
 */
export function OAuthClientList({
  clients,
  editTarget,
  onEdit,
  onDelete,
}: {
  clients: OAuthClientDetail[];
  editTarget: EditTarget | null;
  onEdit: (client: OAuthClientDetail) => void;
  onDelete: (client: OAuthClientDetail) => void;
}) {
  const messages = useMessages(developerMessages);

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th scope="col" className="px-4 py-2 font-normal">
              {messages.nameColumn}
            </th>
            <th scope="col" className="px-4 py-2 font-normal">
              {messages.clientIdColumn}
            </th>
            <th scope="col" className="px-4 py-2">
              <span className="sr-only">{messages.actionsColumn}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {clients.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-3 text-muted">
                {messages.noClients}
              </td>
            </tr>
          ) : (
            clients.map((client) => {
              const isEditing = editTarget?.kind === "existing" && editTarget.client.clientId === client.clientId;
              return (
                <tr key={client.clientId} className={`border-b border-border last:border-b-0 ${isEditing ? "bg-accent-soft" : ""}`}>
                  <td className="px-4 py-2 break-all">{client.name}</td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1">
                      <code className="font-mono text-xs break-all">{client.clientId}</code>
                      <ClientIdCopyButton clientId={client.clientId} label={messages.copyClientIdOf(client.name)} />
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={messages.editClientLabel(client.name)}
                        onPress={() => onEdit(client)}
                      >
                        {messages.editClient}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={messages.deleteClientLabel(client.name)}
                        onPress={() => onDelete(client)}
                      >
                        {messages.deleteClient}
                      </Button>
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 一覧の行のClient IDをコピーするアイコンのボタン。
 * 結果は`role="status"`のテキストで読み上げる。
 */
function ClientIdCopyButton({ clientId, label }: { clientId: string; label: string }) {
  const common = useMessages(commonMessages);
  const { status, copy } = useCopyText();
  return (
    <>
      <Button size="sm" variant="ghost" isIconOnly aria-label={label} onPress={() => void copy(clientId)}>
        <CopyIcon className="size-4" />
      </Button>
      <span role="status" className="text-xs text-muted">
        {status === "copied" ? common.copied : status === "failed" ? common.copyFailed : ""}
      </span>
    </>
  );
}
