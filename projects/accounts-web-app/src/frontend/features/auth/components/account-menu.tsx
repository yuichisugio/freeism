import { Chip, Description, Dropdown, Label, Separator } from "@heroui/react";
import type { ReactNode } from "react";

import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { ArrowRightIcon, CheckIcon, LogoutIcon, PersonIcon, PlusIcon } from "../../app-shell/components/icons";
import { ErrorText } from "../../app-shell/components/status-messages";
import { useAccountSwitcher } from "../hooks/use-account-switcher";
import { useDeviceSessions } from "../hooks/use-device-sessions";
import { useLoginDialog } from "../hooks/use-login-dialog";
import { authMessages } from "../messages";

/**
 * ログイン中の現在のユーザー。
 */
export type CurrentUser = {
  sessionToken: string;
  accountsUserId: string;
  displayName: string;
};

const currentUserKey = "current-user";
const addAccountKey = "add-account";
const signOutKey = "sign-out";
const sessionKeyPrefix = "session:";

/**
 * ヘッダー右の人のアイコンから開くアカウント切替メニュー。
 * 見出しを置かず、現在のユーザー（先頭・強調・「現在」チップ）、このブラウザーでログイン中のほかのユーザー（押すと切替）、「アカウントを追加」、区切り、「「{表示名}」からログアウト」の順に並べる。
 * ユーザーの行はアバターを置かず、表示名とAccountsユーザーIDだけにする。
 * @see ../../../../../docs/specification/v0.1/design-system.ja.md
 * @see ../../app-shell/components/app-header.test.tsx
 */
export function AccountMenu({ currentUser }: { currentUser: CurrentUser }) {
  const messages = useMessages(authMessages);
  const common = useMessages(commonMessages);
  const deviceSessions = useDeviceSessions();
  const loginDialog = useLoginDialog();
  const switcher = useAccountSwitcher();
  // 切替の直後も一覧の読み直しを待たずに揃うよう、現在のユーザーのIDで除く。
  const otherSessions =
    deviceSessions.status === "loaded"
      ? deviceSessions.sessions.filter((session) => session.accountsUserId !== currentUser.accountsUserId)
      : [];

  /**
   * メニューの項目（react-ariaの`Key`）ごとの操作。
   * 現在のユーザーの行は切り替えずにメニューを閉じる。
   */
  const handleAction = (key: string | number) => {
    if (key === addAccountKey) {
      loginDialog.open();
    } else if (key === signOutKey) {
      void switcher.signOut(currentUser.sessionToken);
    } else {
      const target = otherSessions.find((session) => `${sessionKeyPrefix}${session.sessionId}` === key);
      if (target !== undefined) void switcher.switchTo(target);
    }
  };

  return (
    <div className="relative">
      {/* 狭い幅でもロゴを押し出さないよう、失敗の案内はヘッダーの行に並べず、人のアイコンの下に重ねる。 */}
      {switcher.failure === null ? null : (
        <div className="absolute end-0 top-full z-10 mt-2 w-(--menu-w) max-w-[calc(100vw-var(--space-8))] rounded-md shadow-overlay">
          <ErrorText>{switcher.failure === "switch" ? messages.switchFailed : messages.signOutFailed}</ErrorText>
        </div>
      )}
      <Dropdown>
        <Dropdown.Trigger
          aria-label={messages.accountMenuLabel(currentUser.displayName)}
          className="grid size-10 place-items-center rounded-full border border-border bg-surface text-foreground hover:border-border-strong aria-expanded:border-accent aria-expanded:bg-accent-soft aria-expanded:text-accent"
        >
          <PersonIcon className="size-5" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end" className="w-(--menu-w) max-sm:w-[calc(100vw-var(--space-8))]">
          <Dropdown.Menu onAction={handleAction} className="p-2">
            <Dropdown.Section aria-label={messages.sessionsLabel}>
              <Dropdown.Item id={currentUserKey} textValue={currentUser.displayName} className="bg-surface-secondary">
                <UserText displayName={currentUser.displayName} accountsUserId={currentUser.accountsUserId} isCurrent />
                <Chip color="success" variant="soft" className="ml-auto">
                  <CheckIcon className="size-3" />
                  {messages.currentUser}
                </Chip>
              </Dropdown.Item>
              {deviceSessions.status === "loaded" ? null : (
                <Dropdown.Item id="sessions-status" isDisabled>
                  <Label>{deviceSessions.status === "loading" ? common.loading : messages.sessionsLoadFailed}</Label>
                </Dropdown.Item>
              )}
              {otherSessions.map((session) => (
                <Dropdown.Item
                  key={session.sessionId}
                  id={`${sessionKeyPrefix}${session.sessionId}`}
                  textValue={session.displayName}
                >
                  <UserText displayName={session.displayName} accountsUserId={session.accountsUserId} />
                  <ArrowRightIcon className="ml-auto size-4 shrink-0 text-muted" />
                </Dropdown.Item>
              ))}
            </Dropdown.Section>
            <Dropdown.Item id={addAccountKey} textValue={messages.addAccount}>
              <MenuItemIcon>
                <PlusIcon className="size-5" />
              </MenuItemIcon>
              <Label>{messages.addAccount}</Label>
            </Dropdown.Item>
            <Separator className="my-1" />
            <Dropdown.Item id={signOutKey} textValue={messages.signOutFrom(currentUser.displayName)}>
              <MenuItemIcon>
                <LogoutIcon className="size-5" />
              </MenuItemIcon>
              <Label>{messages.signOutFrom(currentUser.displayName)}</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}

/**
 * 表示名とAccountsユーザーIDの2段。
 * メニュー項目の名前を表示名、説明をAccountsユーザーIDとして読み上げる。
 */
function UserText({
  displayName,
  accountsUserId,
  isCurrent = false,
}: {
  displayName: string;
  accountsUserId: string;
  isCurrent?: boolean;
}) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5 leading-tight">
      <Label className={`break-all ${isCurrent ? "font-bold" : ""}`}>{displayName}</Label>
      <Description className="font-mono text-xs break-all text-muted">{accountsUserId}</Description>
    </span>
  );
}

/**
 * 「アカウントを追加」「ログアウト」のアイコンの台。
 */
function MenuItemIcon({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-(--avatar) shrink-0 place-items-center rounded-full bg-surface-secondary text-muted">
      {children}
    </span>
  );
}
