import type { ReactNode } from "react";

/**
 * 画面の本文の枠。
 * トップ・アカウント連携・その他・使い方・法務ページで同じ最大幅（`--page-max`）と余白にする。
 * @see ../../../../../docs/specification/v0.1/design-system.ja.md
 */
export function PageMain({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-(--page-max) flex-col gap-6 px-6 pt-4 pb-10 max-sm:px-4 max-sm:pt-3 max-sm:pb-8">
      {children}
    </main>
  );
}
