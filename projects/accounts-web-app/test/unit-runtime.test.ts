import { describe, expect, it } from "vitest";

describe("単体テストの実行環境", () => {
  it("Node.js上で実行される", () => {
    expect(process.versions.node).toMatch(/^\d+\./);
  });
});
