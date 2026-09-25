import { describe, expect, it } from "vitest";

import { createRandomId } from "./id";

describe("createRandomId", () => {
  it("prefixに128bitのURL-safe乱数（base64url 22文字）を付ける", () => {
    expect(createRandomId("ausr_")).toMatch(/^ausr_[A-Za-z0-9_-]{22}$/);
  });

  it("prefixを省略すると乱数部分だけを返す", () => {
    expect(createRandomId()).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("呼出しごとに異なる値を返す", () => {
    const ids = new Set(Array.from({ length: 100 }, () => createRandomId("eac_")));

    expect(ids.size).toBe(100);
  });
});
