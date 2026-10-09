/**
 * ルーターのクエリ文字列の読み書き。
 * OAuth Providerの署名付きクエリ（`sig`・繰返しの`ba_param`など）を、値の型変換や配列のJSON化で書き換えないよう、値を文字列のまま扱う。
 * ルーターは表示時にクエリを書き直すため、読み書きで値と繰返しを保つ必要がある。
 * @see ./search-params.test.ts
 */

/**
 * クエリ文字列の値。
 * 同じ名前が繰り返される場合は出現順の配列にする。
 */
export type RawSearch = Record<string, string | string[]>;

/**
 * クエリ文字列を、値を文字列のまま読み取る。
 */
export function parseRawSearch(searchString: string): RawSearch {
  const params = new URLSearchParams(searchString);
  const search: RawSearch = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    search[key] = values.length === 1 ? (values[0] ?? "") : values;
  }
  return search;
}

/**
 * 値と繰返しを保ってクエリ文字列にする。
 */
export function stringifyRawSearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      params.append(key, String(item));
    }
  }
  const searchString = params.toString();
  return searchString === "" ? "" : `?${searchString}`;
}
