import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { OperationPage } from "../client/components/operation-page";

describe("Points application routes", () => {
  it("renders loading, empty and error guidance in the shared operation surface", () => {
    const html = renderToStaticMarkup(
      <OperationPage description="説明" eyebrow="ADMIN" title="照合">
        <p>差分はありません。</p>
      </OperationPage>,
    );

    expect(html).toContain("照合");
    expect(html).toContain("差分はありません。");
    expect(html).toContain("日本語");
    expect(html).toContain("English");
  });
});
