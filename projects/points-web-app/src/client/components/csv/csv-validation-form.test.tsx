import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { CsvValidationForm } from "./csv-validation-form";

describe("CsvValidationForm", () => {
  it("provides an accessible file picker and no drag-only input", () => {
    const html = renderToStaticMarkup(
      <CsvValidationForm endpoint="/api/fixes/validate" title="FIX" />,
    );

    expect(html).toContain('type="file"');
    expect(html).toContain('accept=".csv,text/csv"');
    expect(html).toContain("CSVファイルを選択");
    expect(html).not.toContain("dropzone");
  });
});
