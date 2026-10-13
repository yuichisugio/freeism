import { describe, expect, it } from "vitest";

import { formatUtcDateTime } from "./format-date-time";

describe("formatUtcDateTime", () => {
  it.each([
    ["2026-09-12T14:03:59.999Z", "2026/09/12 14:03 (UTC)"],
    ["2026-01-02T03:04:00Z", "2026/01/02 03:04 (UTC)"],
    ["2026-09-13T08:30:00+09:00", "2026/09/12 23:30 (UTC)"],
  ])("RFC 3339の%sをUTCの%sで表示する", (value, expected) => {
    expect(formatUtcDateTime(value)).toBe(expected);
  });
});
