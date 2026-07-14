const API_PREFIXES = ["/api", "/.well-known"] as const;

export function isSpaNavigationRequest(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  const { pathname } = new URL(request.url);
  if (API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return false;
  }

  const lastSegment = pathname.split("/").at(-1) ?? "";
  if (/\.[^./]+$/.test(lastSegment)) {
    return false;
  }

  if (!request.headers.get("Accept")?.toLowerCase().includes("text/html")) {
    return false;
  }

  const mode = request.headers.get("Sec-Fetch-Mode");
  if (mode !== null && mode !== "navigate") {
    return false;
  }

  const destination = request.headers.get("Sec-Fetch-Dest");
  return destination === null || destination === "document";
}
