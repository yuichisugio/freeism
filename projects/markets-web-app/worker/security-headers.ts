const PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=(), payment=(), usb=()";

function contentSecurityPolicy(env: Env): string {
  const connectSource = env.APP_ENV === "local" ? "'self'" : `'self' wss://${env.APP_HOST}`;
  const directives = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSource}`,
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "worker-src 'none'",
  ];
  if (env.APP_ENV !== "local") {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}

export function withSecurityHeaders(response: Response, env: Env, cacheControl?: string): Response {
  const headers = new Headers(response.headers);
  if (!headers.has("Content-Security-Policy")) {
    headers.set("Content-Security-Policy", contentSecurityPolicy(env));
  }
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  headers.set("X-Frame-Options", "DENY");
  if (env.APP_ENV === "staging") {
    headers.set("Strict-Transport-Security", "max-age=86400");
  } else if (env.APP_ENV === "production") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  if (cacheControl !== undefined) {
    headers.set("Cache-Control", cacheControl);
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
