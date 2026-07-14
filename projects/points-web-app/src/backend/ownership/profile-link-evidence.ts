import { normalizeIdentityUrl } from "../domain/ownership/normalize-identity-url";

interface LinkCandidate {
  href: string;
  relMe: boolean;
}

function relHasMe(value: string | null): boolean {
  return value?.split(/\s+/).some((token) => token.toLowerCase() === "me") ?? false;
}

function parseHttpLinkHeader(value: string | null): LinkCandidate[] {
  if (!value) return [];
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;
  let inAngle = false;
  for (const character of value) {
    if (character === '"') inQuotes = !inQuotes;
    if (!inQuotes && character === "<") inAngle = true;
    if (!inQuotes && character === ">") inAngle = false;
    if (character === "," && !inQuotes && !inAngle) {
      parts.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  if (current) parts.push(current);
  return parts.flatMap((part) => {
    const match = /^\s*<([^>]+)>\s*(.*)$/.exec(part);
    if (!match) return [];
    const rel = /(?:^|;)\s*rel\s*=\s*(?:"([^"]*)"|([^;\s]+))/i.exec(match[2] ?? "");
    return [{ href: match[1]!, relMe: relHasMe(rel?.[1] ?? rel?.[2] ?? null) }];
  });
}

function collectWithDomParser(html: string): LinkCandidate[] {
  const document = new DOMParser().parseFromString(html, "text/html");
  if (!document) return [];
  return [...document.querySelectorAll("a[href],link[href]")]
    .filter((element) => !element.closest("code,pre,script,iframe,template"))
    .map((element) => ({
      href: element.getAttribute("href")!,
      relMe: relHasMe(element.getAttribute("rel")),
    }));
}

async function collectWithHtmlRewriter(html: string): Promise<LinkCandidate[]> {
  const candidates: LinkCandidate[] = [];
  let blockedDepth = 0;
  const rewriter = new HTMLRewriter();
  for (const selector of ["code", "pre", "script", "iframe", "template"]) {
    rewriter.on(selector, {
      element(element) {
        blockedDepth += 1;
        element.onEndTag(() => {
          blockedDepth -= 1;
        });
      },
    });
  }
  rewriter.on("a[href], link[href]", {
    element(element) {
      if (blockedDepth > 0) return;
      const href = element.getAttribute("href");
      if (href) candidates.push({ href, relMe: relHasMe(element.getAttribute("rel")) });
    },
  });
  await rewriter
    .transform(new Response(html, { headers: { "Content-Type": "text/html" } }))
    .arrayBuffer();
  return candidates;
}

export async function hasProfileLinkEvidence(input: {
  documentUrl: string;
  html: string;
  linkHeader: string | null;
  parseHtml?: boolean;
  profileUrl: string;
}): Promise<boolean> {
  const htmlCandidates =
    input.parseHtml === false
      ? []
      : typeof HTMLRewriter === "undefined"
        ? collectWithDomParser(input.html)
        : await collectWithHtmlRewriter(input.html);
  const candidates = [...htmlCandidates, ...parseHttpLinkHeader(input.linkHeader)];
  const relevant = candidates.some((candidate) => candidate.relMe)
    ? candidates.filter((candidate) => candidate.relMe)
    : candidates;
  const expected = normalizeIdentityUrl(input.profileUrl);
  return relevant.some((candidate) => {
    try {
      return (
        normalizeIdentityUrl(new URL(candidate.href, input.documentUrl).toString()) === expected
      );
    } catch {
      return false;
    }
  });
}
