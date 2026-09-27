import { describe, expect, it } from "vite-plus/test";

import { createCsvExportCursor, parseCsvExportCursor } from "./csv-export-cursor";

describe("CSV export cursor", () => {
  it("round trips a valid ordinal", () => {
    expect(parseCsvExportCursor(createCsvExportCursor(1_000))).toBe(1_000);
  });

  it.each(["", "-1", "01", "1.5", "NaN", "9007199254740992", "1,2"])(
    "rejects an invalid cursor: %s",
    (cursor) => {
      expect(() => parseCsvExportCursor(cursor)).toThrow("CSV_EXPORT_CURSOR_INVALID");
    },
  );

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects an invalid next ordinal: %s",
    (nextOrdinal) => {
      expect(() => createCsvExportCursor(nextOrdinal)).toThrow("CSV_EXPORT_CURSOR_INVALID");
    },
  );
});
