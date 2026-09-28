import { useState } from "react";

import { buildFaviconUrl } from "../../../../shared/favicon-url";
import { GlobeIcon } from "./icons";

/**
 * 配信の既定画像（取得できなかったホスト）の幅の上限。
 */
const defaultFaviconMaxWidth = 16;

/**
 * 外部アカウントのサービスアイコン（ファビコン）。
 * ファビコンを台（`--favicon-plate`）に載せてダークでも見えるようにし、読み込めなければ地球儀のアイコンに差し替える。
 * 配信は未知のホストにも HTTP 404 で16pxの既定画像を返し、ブラウザーはそれを表示して`onError`が起きないため、読み込み後の実寸でも判定する。
 * 台は36pxとし、狭い幅の表では表側のCSSで28pxに上書きする。
 * @see ../../../../../docs/specification/v0.1/design-system.ja.md
 * @see ./service-favicon.test.tsx
 */
export function ServiceFavicon({ host }: { host: string }) {
  // ホストが変わったら読み込み直すため、失敗したホストを覚える。
  const [failedHost, setFailedHost] = useState<string | null>(null);
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-favicon-plate">
      {failedHost === host ? (
        <GlobeIcon className="size-5 text-favicon-fallback" />
      ) : (
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
      )}
    </span>
  );
}
