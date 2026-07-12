import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { findGeneratedWorkerConfig } from "./assert-worker-build.mjs";

const HTML_ARTIFACTS = ["index.html", "terms.html", "privacy.html", "help.html", "docs.html"];
const STATIC_PAGE_PATHS = [
  "/",
  "/index.html",
  "/terms",
  "/terms.html",
  "/privacy",
  "/privacy.html",
  "/help",
  "/help.html",
  "/docs",
  "/docs.html",
];

export async function generateStaticSecurityHeaders(appPath, environment) {
  const configPath = await findGeneratedWorkerConfig(appPath);
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const assetsDirectory = path.resolve(path.dirname(configPath), config.assets.directory);

  const inlineScriptHashes = new Set();
  for (const artifact of HTML_ARTIFACTS) {
    try {
      const htmlPath = path.join(assetsDirectory, artifact);
      await access(htmlPath);
      const html = await readFile(htmlPath, "utf8");
      for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (!/\bsrc\s*=/i.test(match[1]) && match[2]) {
          inlineScriptHashes.add(
            `'sha256-${createHash("sha256").update(match[2]).digest("base64")}'`,
          );
        }
      }
    } catch {
      throw new Error(`missing HTML artifact: ${artifact}`);
    }
  }

  const host = config.vars?.APP_HOST;
  if (!host || config.vars?.APP_ENV !== environment) {
    throw new Error(`generated config does not match environment: ${environment}`);
  }

  const hsts =
    environment === "production" ? "max-age=31536000; includeSubDomains" : "max-age=86400";
  const scriptSources = ["'self'", ...inlineScriptHashes].join(" ");
  const pageHeaders = [
    "  Cache-Control: no-store",
    `  Content-Security-Policy: default-src 'none'; script-src ${scriptSources}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' wss://${host}; form-action 'self'; base-uri 'none'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; manifest-src 'self'; worker-src 'none'; upgrade-insecure-requests`,
    "  X-Content-Type-Options: nosniff",
    "  X-Frame-Options: DENY",
    "  Referrer-Policy: no-referrer",
    "  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    `  Strict-Transport-Security: ${hsts}`,
  ];
  const lines = STATIC_PAGE_PATHS.flatMap((requestPath) => [requestPath, ...pageHeaders, ""]);
  lines.push("/assets/*", "  Cache-Control: public, max-age=31536000, immutable", "");
  await writeFile(path.join(assetsDirectory, "_headers"), lines.join("\n"));
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await generateStaticSecurityHeaders(process.argv[2], process.argv[3]);
}
