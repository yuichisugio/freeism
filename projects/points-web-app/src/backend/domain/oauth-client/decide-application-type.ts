/** Accounts v0.1 と同じ `application_type` の判定。 */
export function decideApplicationType(redirectUris: readonly string[]): "web" | "native" {
  return redirectUris.some((redirectUri) => {
    const url = new URL(redirectUri);
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]")
    );
  })
    ? "native"
    : "web";
}
