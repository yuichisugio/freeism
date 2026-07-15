import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { CsvExportPanel } from "./csv-export-panel";

describe("CsvExportPanel", () => {
  it("shows snapshot scope, page size and sequential download controls", () => {
    const html = renderToStaticMarkup(<CsvExportPanel />);

    expect(html).toContain("1000");
    expect(html).toContain("30分");
    expect(html).toContain("次のCSVを取得");
    expect(html).toContain("非公開データ");
  });
});
