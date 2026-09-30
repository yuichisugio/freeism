import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { IndexPage } from "./index";
import { FixedPageView } from "../content/fixed-pages";

describe("Points shell", () => {
  it("names the service and shows the empty balance state", () => {
    const html = renderToStaticMarkup(<IndexPage />);

    expect(html).toContain(">Freeism Points</h1>");
    expect(html).toContain("表示できるポイント残高はまだありません。");
    expect(html).not.toContain("Freeism Marketsへ");
  });
});

describe("fixed public pages", () => {
  it("renders both canonical locales", () => {
    const html = renderToStaticMarkup(
      <FixedPageView
        page={{
          en: { markdown: "# Terms\n\n- English item" },
          ja: { markdown: "# 利用規約\n\n- 日本語項目" },
          route: "terms",
        }}
      />,
    );

    expect(html).toContain('lang="ja"');
    expect(html).toContain('lang="en"');
    expect(html).toContain("<h1>利用規約</h1>");
    expect(html).toContain("<h1>Terms</h1>");
  });
});
