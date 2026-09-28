import { useState } from "react";

import { buildFaviconUrl } from "../../../../shared/favicon-url";
import type { ServiceIconSource } from "../../../../shared/service-icon";
import { GlobeIcon, LoginProviderIcon } from "./icons";

/**
 * 配信の既定画像（取得できなかったホスト）の幅の上限。
 */
const defaultFaviconMaxWidth = 16;

/**
 * 外部アカウントのサービスアイコン。
 * アイコンを台（`--favicon-plate`）に載せてダークでも見えるようにする。
 * OAuth Providerはログインボタンと同じブランドのアイコンを使い、ファビコンの配信を使わない（配信はORCIDにも16pxの画像を返すため）。
 * 台は36pxとし、狭い幅の表では表側のCSSで28pxに上書きする。
 * @see ../../../../../docs/specification/v0.1/design-system/design-system.ja.md
 * @see ./service-icon.test.tsx
 */
export function ServiceIcon({ icon }: { icon: ServiceIconSource }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-favicon-plate">
      {icon.type === "provider" ? (
        <LoginProviderIcon provider={icon.provider} className="size-5 text-brand-github" />
      ) : (
        <Favicon host={icon.host} />
      )}
    </span>
  );
}

/**
 * ホストのファビコン。
 * 読み込めなければ地球儀のアイコンに差し替える。
 * 配信は未知のホストにも HTTP 404 で16pxの既定画像を返し、ブラウザーはそれを表示して`onError`が起きないため、読み込み後の実寸でも判定する。
 */
function Favicon({ host }: { host: string }) {
  // ホストが変わったら読み込み直すため、失敗したホストを覚える。
  const [failedHost, setFailedHost] = useState<string | null>(null);
  if (failedHost === host) return <GlobeIcon className="size-5 text-favicon-fallback" />;
  return (
    <img
      src={buildFaviconUrl(host)}
      alt=""
      width={20}
      height={20}
      loading="lazy"
      className="block size-5"
      onLoad={(event) => {
        // 64pxを頼んで16px以下が返ったら、配信の既定画像とみなす。
        if (event.currentTarget.naturalWidth <= defaultFaviconMaxWidth) setFailedHost(host);
      }}
      onError={() => setFailedHost(host)}
    />
  );
}
