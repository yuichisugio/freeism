/**
 * base64url（RFC 4648 §5、paddingなし）の変換。
 */

// --------------------------------------------------
// 変換
// --------------------------------------------------

/**
 * bytesをbase64urlの文字列にする。
 */
export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/**
 * base64urlの文字列をbytesに戻す。
 */
export function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
