import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { ConsentPanel } from "./consent-panel";

describe("ConsentPanel", () => {
  it("explains requested scopes and offers explicit approve and deny actions", () => {
    const html = renderToStaticMarkup(
      <ConsentPanel
        clientName="Freeism Markets"
        scopes={["points.balance.read", "points.reservations.create", "offline_access"]}
      />,
    );

    expect(html).toContain("ポイント残高を確認");
    expect(html).toContain("入札時にポイントを予約");
    expect(html).toContain("ログインしていない間も連携を維持");
    expect(html).toContain("許可する");
    expect(html).toContain("許可しない");
  });
});
