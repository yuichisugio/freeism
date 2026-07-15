import { pathToFileURL } from "node:url";

const ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_000;
const REQUEST_TIMEOUT_MS = 10_000;

function canonicalHref(html) {
  for (const tag of html.match(/<link\b[^>]*>/giu) ?? []) {
    const attributes = new Map();
    const pattern = /\b([a-z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/giu;
    for (const match of tag.matchAll(pattern)) {
      attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4]);
    }

    const rel = attributes.get("rel")?.toLowerCase().split(/\s+/u) ?? [];
    if (rel.includes("canonical")) {
      return attributes.get("href");
    }
  }
  return undefined;
}

export async function validateStaticSite({
  baseUrl,
  canonicalUrl,
  requiredText = [],
  requiredLinks = [],
  fetchImpl = fetch,
}) {
  let response;
  try {
    response = await fetchImpl(baseUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new Error("request failed");
  }
  if (!response.ok) {
    throw new Error(`unexpected HTTP status ${response.status}`);
  }

  const html = await response.text();
  const href = canonicalHref(html);
  if (!href || new URL(href, baseUrl).href !== new URL(canonicalUrl).href) {
    throw new Error("canonical URL mismatch");
  }

  for (const text of requiredText) {
    if (!html.includes(text)) {
      throw new Error("missing required text");
    }
  }
  for (const link of requiredLinks) {
    if (!html.includes(link)) {
      throw new Error("missing required link");
    }
  }
}

function parseArguments(args) {
  const options = { requiredText: [], requiredLinks: [] };
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value) {
      throw new Error("invalid smoke arguments");
    }

    if (flag === "--url") options.baseUrl = value;
    else if (flag === "--canonical") options.canonicalUrl = value;
    else if (flag === "--text") options.requiredText.push(value);
    else if (flag === "--link") options.requiredLinks.push(value);
    else throw new Error("invalid smoke arguments");
  }

  if (!options.baseUrl || !options.canonicalUrl) {
    throw new Error("invalid smoke arguments");
  }
  return options;
}

async function validateWithRetries(options) {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      await validateStaticSite(options);
      return;
    } catch (error) {
      if (attempt === ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

const isCommandLine = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCommandLine) {
  try {
    await validateWithRetries(parseArguments(process.argv.slice(2)));
    console.log("Static site smoke check passed.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Static site smoke check failed.");
    process.exitCode = 1;
  }
}
