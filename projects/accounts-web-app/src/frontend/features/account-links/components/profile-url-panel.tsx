import { CopyButton } from "../../app-shell/components/copy-button";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { accountLinksMessages } from "../messages";

/**
 * URL入力欄の近くに置く、本人の公開プロフィールURL（DNS TXTの値を兼ねる）とコピー操作。
 */
export function ProfileUrlPanel({ profileUrl }: { profileUrl: string }) {
  const messages = useMessages(accountLinksMessages);
  return (
    <section aria-labelledby="profile-url-heading" className="flex flex-col gap-2">
      <h3 id="profile-url-heading" className="text-sm font-semibold">
        {messages.profileUrlLabel}
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        <code className="break-all rounded bg-default px-2 py-1 text-sm">{profileUrl}</code>
        <CopyButton text={profileUrl} />
      </div>
      <p className="text-sm text-muted">{messages.profileUrlDescription}</p>
    </section>
  );
}
