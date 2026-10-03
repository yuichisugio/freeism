import { Button } from "@heroui/react";

import type { OAuthClientDetail } from "../../../../shared/schemas/oauth-client-schema";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import type { EditTarget } from "../hooks/use-oauth-clients";
import { developerMessages } from "../messages";

/**
 * 本人のOAuthクライアントの一覧（アプリ名・Client ID・「編集」「削除」）。
 * セルは折り返さず、狭い幅では枠の中で横にスクロールし、先頭列（アプリ名）を左端に留める。
 * 編集中の行は主色の淡い面にする。
 * 保存中（`isDisabled`）は、編集対象を変えさせないため「編集」「削除」を無効にする。
 * Client IDのコピーは編集フォームで行う。
 * @see ../../../../../docs/specification/v0.1/design-system/design-system.ja.md
 * @see ./developer-section.test.tsx
 */
export function OAuthClientList({
  clients,
  editTarget,
  isDisabled,
  onEdit,
  onDelete,
}: {
  clients: OAuthClientDetail[];
  editTarget: EditTarget | null;
  isDisabled: boolean;
  onEdit: (client: OAuthClientDetail) => void;
  onDelete: (client: OAuthClientDetail) => void;
}) {
  const messages = useMessages(developerMessages);

  return (
    <div className="relative w-full overflow-auto rounded-lg border border-border">
      <table className="w-full min-w-[calc(440px*var(--scale))] border-separate border-spacing-0 text-sm whitespace-nowrap [&_tbody_tr:last-child>*]:border-b-0">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" className={`${cellClassName} ${leadCellClassName} bg-surface font-normal`}>
              {messages.nameColumn}
            </th>
            <th scope="col" className={`${cellClassName} bg-surface font-normal`}>
              {messages.clientIdColumn}
            </th>
            <th scope="col" className={`${cellClassName} bg-surface`}>
              <span className="sr-only">{messages.actionsColumn}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {clients.length === 0 ? (
            <tr>
              <td colSpan={3} className={`${cellClassName} text-muted`}>
                {messages.noClients}
              </td>
            </tr>
          ) : (
            clients.map((client) => {
              const isEditing = editTarget?.kind === "existing" && editTarget.client.clientId === client.clientId;
              // 先頭列は横スクロールで本文に重なるため、行の面の色をセルごとに塗る。
              const rowBackground = isEditing ? "bg-accent-soft" : "bg-surface";
              return (
                <tr key={client.clientId}>
                  <td className={`${cellClassName} ${leadCellClassName} ${rowBackground}`}>{client.name}</td>
                  <td className={`${cellClassName} ${rowBackground} font-mono`}>{client.clientId}</td>
                  <td className={`${cellClassName} ${rowBackground}`}>
                    <span className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={messages.editClientLabel(client.name)}
                        isDisabled={isDisabled}
                        onPress={() => onEdit(client)}
                      >
                        {messages.editClient}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={messages.deleteClientLabel(client.name)}
                        isDisabled={isDisabled}
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

// --------------------------------------------------
// セルの見た目
// --------------------------------------------------

const cellClassName = "border-b border-border px-4 py-3 align-middle max-sm:px-3 max-sm:py-2";
const leadCellClassName = "sticky left-0 z-1 shadow-[inset_-1px_0_0_var(--border)]";
