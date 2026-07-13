const RESERVED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".home",
  ".lan",
  ".test",
  ".invalid",
  ".example",
] as const;

export function normalizeIdentityUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("IDENTITY_URL_INVALID");
  }
  const hostname = url.hostname.toLowerCase();
  const isIpLiteral = hostname.startsWith("[") || /^[0-9.]+$/.test(hostname);
  const isReserved =
    hostname === "localhost" ||
    !hostname.includes(".") ||
    RESERVED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
  if (
    url.protocol !== "https:" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    hostname.endsWith(".") ||
    isIpLiteral ||
    isReserved
  ) {
    throw new Error("IDENTITY_URL_INVALID");
  }
  url.hash = "";
  return url.toString();
}
