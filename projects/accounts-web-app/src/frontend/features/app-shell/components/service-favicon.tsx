import { useState } from "react";

import { buildFaviconUrl } from "../../../../shared/favicon-url";
import { GlobeIcon } from "./icons";

const plateSizeClassNames = { md: "size-9", sm: "size-7" } as const;

/**
 * 外部アカウントのサービスアイコン（ファビコン）。
 * ファビコンを台（`--favicon-plate`）に載せてダークでも見えるようにし、読み込めなければ地球儀のアイコンに差し替える。
 * 台は通常36px、狭い幅の表では`size="sm"`（28px）にする。
 * @see ../../../../../docs/specification/v0.1/design-system.ja.md
 * @see ./service-favicon.test.tsx
 */
export function ServiceFavicon({ host, size = "md" }: { host: string; size?: keyof typeof plateSizeClassNames }) {
  // ホストが変わったら読み込み直すため、失敗したホストを覚える。
  const [failedHost, setFailedHost] = useState<string | null>(null);
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-md border border-border bg-favicon-plate ${plateSizeClassNames[size]}`}
    >
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
          onError={() => setFailedHost(host)}
        />
      )}
    </span>
  );
}
