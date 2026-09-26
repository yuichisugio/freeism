import { describe, expect, it } from "vitest";

import { maxJsonBindBytes, toJsonBinds } from "./d1-backup-repository";

describe("toJsonBinds", () => {
  it("行が無ければバインド値を作らない", () => {
    expect(toJsonBinds([])).toEqual([]);
  });

  it("小さい配列は1つのバインド値にまとめる", () => {
    expect(toJsonBinds([{ id: "a" }, { id: "b" }])).toEqual(['[{"id":"a"},{"id":"b"}]']);
  });

  it("上限を超える配列は、各バインド値を上限以内にして順序を保って分ける", () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({ index, text: "あ".repeat(130_000) }));

    const binds = toJsonBinds(rows);

    expect(binds).toHaveLength(3);
    for (const bind of binds) {
      expect(new TextEncoder().encode(bind).length).toBeLessThanOrEqual(maxJsonBindBytes);
    }
    expect(binds.flatMap((bind) => JSON.parse(bind) as unknown[])).toEqual(rows);
  });
});
