/**
 * `external_identifiers`の識別子の種類。
 */
export type IdentifierKind = "url" | "provider_account" | "provider_username";

/**
 * 保存・照合に使う識別子キー。
 * NULLを含めない`(kind, provider, issuer, value)`で一意性を判定し、`host`はURL行だけに持つ。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */
export type IdentifierKey = {
  kind: IdentifierKind;
  provider: string;
  issuer: "";
  value: string;
  host: string | null;
};

/**
 * 2つの識別子キーが同じ識別子を表すかを判定する。
 */
export function isSameIdentifierKey(
  left: { kind: IdentifierKind; provider: string; issuer: string; value: string },
  right: { kind: IdentifierKind; provider: string; issuer: string; value: string },
): boolean {
  return (
    left.kind === right.kind &&
    left.provider === right.provider &&
    left.issuer === right.issuer &&
    left.value === right.value
  );
}
