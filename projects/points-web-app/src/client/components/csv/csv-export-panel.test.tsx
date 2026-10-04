import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { CsvExportPanel } from "./csv-export-panel";

describe("CsvExportPanel", () => {
  it("shows direct export and page size controls", () => {
    const html = renderToStaticMarkup(<CsvExportPanel />);

    expect(html).toContain("1000");
    expect(html).toContain("取得時点");
    expect(html).not.toContain("スナップショット");
    expect(html).toContain("CSVを取得");
    expect(html).toContain("非公開データ");
  });
});
