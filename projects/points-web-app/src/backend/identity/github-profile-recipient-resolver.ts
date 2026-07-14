export interface ResolvedGitHubRecipient {
  accountId: string;
  normalizedProfileUrl: string;
  providerId: "github";
}

export class GitHubIdentityLookupError extends Error {
  constructor(
    readonly code:
      | "GITHUB_PROFILE_URL_INVALID"
      | "GITHUB_IDENTITY_LOOKUP_INVALID"
      | "GITHUB_IDENTITY_LOOKUP_RATE_LIMITED"
      | "GITHUB_IDENTITY_LOOKUP_TIMEOUT"
      | "GITHUB_IDENTITY_LOOKUP_UNAVAILABLE",
    readonly retryAfter: string | null = null,
  ) {
    super(code);
  }
}

export interface GitHubRateLimitObservation {
  remaining: number | null;
  resetAtSeconds: number | null;
}

interface ResolveOptions {
  clientId: string;
  clientSecret: string;
  fetcher?: typeof fetch;
  perRequestTimeoutMs?: number;
  overallTimeoutMs?: number;
  onRateLimitObservation?: (observation: GitHubRateLimitObservation) => void | Promise<void>;
}

const LOGIN = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/i;

export function normalizeGitHubProfileUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new GitHubIdentityLookupError("GITHUB_PROFILE_URL_INVALID");
  }
  const path = url.pathname.replace(/\/$/, "");
  const parts = path.split("/").filter(Boolean);
  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== "github.com" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    parts.length !== 1 ||
    !LOGIN.test(parts[0]!)
  ) {
    throw new GitHubIdentityLookupError("GITHUB_PROFILE_URL_INVALID");
  }
  return `https://github.com/${parts[0]!.toLowerCase()}`;
}

function integerHeader(headers: Headers, name: string): number | null {
  const value = headers.get(name);
  if (value === null || !/^[0-9]+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function lookupError(response: Response): GitHubIdentityLookupError {
  if (
    response.status === 429 ||
    (response.status === 403 && response.headers.get("X-RateLimit-Remaining") === "0")
  ) {
    return new GitHubIdentityLookupError(
      "GITHUB_IDENTITY_LOOKUP_RATE_LIMITED",
      response.headers.get("Retry-After"),
    );
  }
  return new GitHubIdentityLookupError("GITHUB_IDENTITY_LOOKUP_UNAVAILABLE");
}

async function resolveOne(
  normalizedProfileUrl: string,
  options: Required<Pick<ResolveOptions, "clientId" | "clientSecret" | "fetcher">> &
    Pick<ResolveOptions, "onRateLimitObservation"> & { signal: AbortSignal },
): Promise<ResolvedGitHubRecipient> {
  const login = normalizedProfileUrl.slice("https://github.com/".length);
  let response: Response;
  try {
    response = await options.fetcher(`https://api.github.com/users/${encodeURIComponent(login)}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Basic ${btoa(`${options.clientId}:${options.clientSecret}`)}`,
        "User-Agent": "freeism-points-worker",
        "X-GitHub-Api-Version": "2026-03-10",
      },
      signal: options.signal,
    });
  } catch {
    if (options.signal.aborted) {
      throw new GitHubIdentityLookupError("GITHUB_IDENTITY_LOOKUP_TIMEOUT");
    }
    throw new GitHubIdentityLookupError("GITHUB_IDENTITY_LOOKUP_UNAVAILABLE");
  }

  await options.onRateLimitObservation?.({
    remaining: integerHeader(response.headers, "X-RateLimit-Remaining"),
    resetAtSeconds: integerHeader(response.headers, "X-RateLimit-Reset"),
  });
  if (!response.ok) throw lookupError(response);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new GitHubIdentityLookupError("GITHUB_IDENTITY_LOOKUP_INVALID");
  }
  if (typeof body !== "object" || body === null) {
    throw new GitHubIdentityLookupError("GITHUB_IDENTITY_LOOKUP_INVALID");
  }
  const candidate = body as Record<string, unknown>;
  if (
    candidate.type !== "User" ||
    typeof candidate.login !== "string" ||
    typeof candidate.html_url !== "string" ||
    typeof candidate.id !== "number" ||
    !Number.isSafeInteger(candidate.id) ||
    candidate.id <= 0
  ) {
    throw new GitHubIdentityLookupError("GITHUB_IDENTITY_LOOKUP_INVALID");
  }
  let responseProfileUrl: string;
  try {
    responseProfileUrl = normalizeGitHubProfileUrl(candidate.html_url);
  } catch {
    throw new GitHubIdentityLookupError("GITHUB_IDENTITY_LOOKUP_INVALID");
  }
  if (
    responseProfileUrl !== normalizedProfileUrl ||
    candidate.login.toLowerCase() !== login.toLowerCase()
  ) {
    throw new GitHubIdentityLookupError("GITHUB_IDENTITY_LOOKUP_INVALID");
  }
  return {
    accountId: String(candidate.id),
    normalizedProfileUrl,
    providerId: "github",
  };
}

export async function resolveGitHubProfileRecipients(
  profileUrls: readonly string[],
  options: ResolveOptions,
): Promise<Map<string, ResolvedGitHubRecipient>> {
  const normalizedUrls = [...new Set(profileUrls.map(normalizeGitHubProfileUrl))];
  const fetcher = options.fetcher ?? fetch;
  const overallController = new AbortController();
  const overallTimeout = setTimeout(
    () => overallController.abort(),
    options.overallTimeoutMs ?? 120_000,
  );
  const results = new Map<string, ResolvedGitHubRecipient>();
  let nextIndex = 0;

  const worker = async () => {
    while (!overallController.signal.aborted) {
      const index = nextIndex;
      nextIndex += 1;
      const normalizedProfileUrl = normalizedUrls[index];
      if (normalizedProfileUrl === undefined) return;

      const requestController = new AbortController();
      const abortFromOverall = () => requestController.abort();
      overallController.signal.addEventListener("abort", abortFromOverall, { once: true });
      const requestTimeout = setTimeout(
        () => requestController.abort(),
        options.perRequestTimeoutMs ?? 3_000,
      );
      try {
        const result = await resolveOne(normalizedProfileUrl, {
          clientId: options.clientId,
          clientSecret: options.clientSecret,
          fetcher,
          onRateLimitObservation: options.onRateLimitObservation,
          signal: requestController.signal,
        });
        results.set(normalizedProfileUrl, result);
      } finally {
        clearTimeout(requestTimeout);
        overallController.signal.removeEventListener("abort", abortFromOverall);
      }
    }
    throw new GitHubIdentityLookupError("GITHUB_IDENTITY_LOOKUP_TIMEOUT");
  };

  const workers = Array.from({ length: Math.min(6, normalizedUrls.length) }, () => worker());
  try {
    await Promise.all(workers);
  } catch (error) {
    overallController.abort();
    await Promise.allSettled(workers);
    if (error instanceof GitHubIdentityLookupError) throw error;
    throw new GitHubIdentityLookupError("GITHUB_IDENTITY_LOOKUP_UNAVAILABLE");
  } finally {
    clearTimeout(overallTimeout);
  }
  if (overallController.signal.aborted && results.size !== normalizedUrls.length) {
    throw new GitHubIdentityLookupError("GITHUB_IDENTITY_LOOKUP_TIMEOUT");
  }
  return results;
}
