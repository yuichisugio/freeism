import { useEffect, useState } from "react";

import { meSchema } from "../../../../shared/schemas/profile-schema";
import type { Me } from "../../../../shared/schemas/profile-schema";
import { requestBff } from "../../../lib/api-client";

/**
 * 同意画面に表示する、現在のアクティブセッションのAccountsユーザー。
 * 取得できない場合は表示しない（一覧の取得失敗としてログインの案内を示すため）。
 */
export function useActiveUser(isEnabled: boolean): Me | null {
  const [activeUser, setActiveUser] = useState<Me | null>(null);

  useEffect(() => {
    if (!isEnabled) return;
    requestBff("/api/me", meSchema).then(setActiveUser, () => setActiveUser(null));
  }, [isEnabled]);

  return activeUser;
}
