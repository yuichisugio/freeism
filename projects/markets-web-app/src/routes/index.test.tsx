import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { IndexPage } from "./index";
import { FixedPageView } from "../content/fixed-pages";

describe("Markets shell", () => {
  it("names the service, states its auction responsibility, and links to Points", () => {
    const html = renderToStaticMarkup(<IndexPage />);

    expect(html).toContain(">Freeism Markets</h1>");
    expect(html).toContain("商材の出品とAuction作成");
    expect(html).toContain('href="https://points.freeism.app"');
  });
});

describe("fixed public pages", () => {
  it("renders both canonical locales and their source hashes", () => {
    const html = renderToStaticMarkup(
      <FixedPageView
        page={{
          en: { markdown: "# Terms\n\n- English item", sourceSha256: "en-hash" },
          ja: { markdown: "# 利用規約\n\n- 日本語項目", sourceSha256: "ja-hash" },
          route: "terms",
        }}
      />,
    );

    expect(html).toContain('lang="ja"');
    expect(html).toContain('lang="en"');
    expect(html).toContain('data-source-sha256="ja-hash"');
    expect(html).toContain('data-source-sha256="en-hash"');
    expect(html).toContain("<h1>利用規約</h1>");
    expect(html).toContain("<h1>Terms</h1>");
  });
});
