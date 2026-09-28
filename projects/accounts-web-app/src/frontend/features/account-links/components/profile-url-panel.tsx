import { Card } from "@heroui/react";

import { CopyButton } from "../../app-shell/components/copy-button";
import { ExternalLinkIcon } from "../../app-shell/components/icons";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { accountLinksMessages } from "../messages";

/**
 * 「公開プロフィールURL」カード。
 * 本人の公開プロフィールURL（DNS TXTの値を兼ねる）を新しいタブで開く外部リンクにし、右に「コピー」を置く。
 * 狭い幅ではURLを1行使い、「コピー」を次の行に回す。
 * @see ../../../../../docs/specification/v0.1/design-system/design-system.ja.md
 */
export function ProfileUrlPanel({ profileUrl }: { profileUrl: string }) {
  const messages = useMessages(accountLinksMessages);
  return (
    <Card className="gap-4">
      <Card.Header>
        <h2 className="text-lg">{messages.profileUrlTitle}</h2>
      </Card.Header>
      <Card.Content className="flex flex-row items-center gap-3 max-sm:flex-wrap max-sm:gap-y-2">
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener"
          className="min-w-0 font-mono text-lg leading-tight wrap-anywhere max-sm:basis-full"
        >
          {profileUrl}
          <ExternalLinkIcon className="ml-1 inline-block size-4 align-[-2px]" />
          <span className="sr-only">{messages.opensInNewTab}</span>
        </a>
        <span className="shrink-0">
          <CopyButton text={profileUrl} />
        </span>
      </Card.Content>
    </Card>
  );
}
