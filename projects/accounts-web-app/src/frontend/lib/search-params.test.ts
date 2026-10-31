import { describe, expect, it } from "vitest";

import { parseRawSearch, stringifyRawSearch } from "./search-params";

describe("parseRawSearch / stringifyRawSearch", () => {
  it("署名付きクエリの値と繰返しの項目を変えずに読み書きする", () => {
    const signedQuery =
      "client_id=123e4&exp=1727000000&redirect_uri=https%3A%2F%2Fpoints.example%2Fcallback&scope=openid+identities%3Aread&sig=abc&ba_param=client_id&ba_param=exp&ba_param=scope";

    const roundTripped = stringifyRawSearch(parseRawSearch(`?${signedQuery}`));

    expect([...new URLSearchParams(roundTripped).entries()]).toEqual([...new URLSearchParams(signedQuery).entries()]);
  });

  it("数値や真偽値に見える値も文字列のまま読む", () => {
    expect(parseRawSearch("?exp=1727000000&flag=true&id=123e4")).toEqual({ exp: "1727000000", flag: "true", id: "123e4" });
  });

  it("繰り返される項目は出現順の配列にする", () => {
    expect(parseRawSearch("?a=1&a=2")).toEqual({ a: ["1", "2"] });
  });

  it("値が無い場合は空文字列を返す", () => {
    expect(stringifyRawSearch({ error: undefined })).toBe("");
  });
});
