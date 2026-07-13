import { describe, expect, it } from "vite-plus/test";

import { amountCell, encodeCsv, textCell } from "./csv-export";

describe("RFC 4180 CSV export", () => {
  it("quotes separators, quotes and normalized newlines with CRLF records", () => {
    expect(
      encodeCsv(
        ["id", "memo"],
        [
          [textCell("a"), textCell('x,"y"\r\nz\rw')],
          [textCell("b"), textCell("plain")],
        ],
      ),
    ).toBe('id,memo\r\na,"x,""y""\nz\nw"\r\nb,plain\r\n');
  });

  it.each(["=1+1", "+cmd", "-formula", "@sum", "\tformula", "\rformula", "\nformula"])(
    "neutralizes a dangerous text prefix without trimming: %j",
    (value) => {
      const output = encodeCsv(["value"], [[textCell(value)]]);
      expect(output).toContain("'");
      expect(output).not.toContain(`\r\n${value}`);
    },
  );

  it("keeps a validated typed negative amount numeric", () => {
    expect(encodeCsv(["amount"], [[amountCell("-1.2500", "0.0001")]])).toBe(
      "amount\r\n-1.2500\r\n",
    );
  });

  it("rejects an invalid typed amount instead of treating it as trusted text", () => {
    expect(() => encodeCsv(["amount"], [[amountCell("-1e3", "0.0001")]])).toThrow(
      "INVALID_CSV_EXPORT_AMOUNT",
    );
  });
});
