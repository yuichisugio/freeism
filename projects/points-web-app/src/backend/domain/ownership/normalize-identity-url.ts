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

function normalizePercentEncoding(value: string): string {
  return value.replace(/%[0-9a-fA-F]{2}/g, (encoded) => {
    const octet = Number.parseInt(encoded.slice(1), 16);
    const isUnreserved =
      (octet >= 0x41 && octet <= 0x5a) ||
      (octet >= 0x61 && octet <= 0x7a) ||
      (octet >= 0x30 && octet <= 0x39) ||
      octet === 0x2d ||
      octet === 0x2e ||
      octet === 0x5f ||
      octet === 0x7e;
    return isUnreserved ? String.fromCharCode(octet) : `%${encoded.slice(1).toUpperCase()}`;
  });
}

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
  return normalizePercentEncoding(url.toString());
}
