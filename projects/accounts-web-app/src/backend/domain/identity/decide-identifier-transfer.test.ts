import { describe, expect, it } from "vitest";

import { decideIdentifierTransfer } from "./decide-identifier-transfer";

describe("decideIdentifierTransfer", () => {
  it.each([
    { method: "oauth", support: ["oauth"], expected: "move" },
    { method: "oauth", support: ["dns_txt", "bidirectional_link"], expected: "move" },
    { method: "dns_txt", support: ["oauth", "dns_txt"], expected: "move" },
    { method: "bidirectional_link", support: ["bidirectional_link"], expected: "move" },
    { method: "bidirectional_link", support: [], expected: "move" },
    { method: "bidirectional_link", support: ["bidirectional_link", "oauth"], expected: "blocked" },
    { method: "bidirectional_link", support: ["dns_txt"], expected: "blocked" },
  ] as const)(
    "$methodの成功で、旧所有者の支え$supportなら$expected",
    ({ method, support, expected }) => {
      expect(decideIdentifierTransfer(method, support)).toBe(expected);
    },
  );
});
