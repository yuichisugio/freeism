/**
 * 128bitの暗号学的乱数をbase64url（padding無し）にし、prefixを付けたIDを返す。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./id.test.ts
 */
export function createRandomId(prefix = ""): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `${prefix}${Buffer.from(bytes).toString("base64url")}`;
}
