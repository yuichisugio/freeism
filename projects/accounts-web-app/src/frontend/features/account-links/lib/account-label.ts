import type { LinkedAccount } from "../../../../shared/schemas/account-link-schema";
import { formatServiceName } from "../../../lib/service-names";

/**
 * 外部アカウントを見分けるための表示名。
 * 表示名が無い場合は最初の識別子を使う。
 */
export function formatAccountLabel(account: LinkedAccount): string {
  const name = account.displayName ?? account.identifiers[0]?.value ?? account.id;
  return `${formatServiceName(account.service)}: ${name}`;
}
