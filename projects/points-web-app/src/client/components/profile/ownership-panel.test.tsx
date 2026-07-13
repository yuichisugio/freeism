import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { OwnershipPanel } from "./ownership-panel";

describe("OwnershipPanel", () => {
  it("shows GitHub and Web ownership lifecycle actions", () => {
    const html = renderToStaticMarkup(<OwnershipPanel />);

    expect(html).toContain("GitHub");
    expect(html).toContain("再有効化");
    expect(html).toContain("Webページ");
    expect(html).toContain("再検証");
  });
});
