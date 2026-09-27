import * as v from "valibot";

/** 1人の利用者が所有できる OAuth クライアントの上限。 */
export const oauthClientLimitPerUser = 5;
const urlMaxBytes = 2048;
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Accounts v0.1 と同じリダイレクト URL 規則。 */
export function isAllowedRedirectUri(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  if (url.hash !== "" || value.includes("#")) return false;
  if (url.protocol === "https:") {
    return !(
      url.hostname === "localhost" ||
      url.hostname === "[::1]" ||
      /^127\.\d+\.\d+\.\d+$/.test(url.hostname)
    );
  }
  return url.protocol === "http:" && loopbackHosts.has(url.hostname);
}

export const redirectUriSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty(),
  v.maxBytes(urlMaxBytes),
  v.check(
    isAllowedRedirectUri,
    "HTTPS on a non-loopback host, or HTTP on localhost, 127.0.0.1 or [::1], without a fragment.",
  ),
);

export const jwksSchema = v.object({
  keys: v.pipe(v.array(v.looseObject({ kty: v.string() })), v.minLength(1)),
});

const httpsUrlSchema = v.pipe(
  v.string(),
  v.url(),
  v.startsWith("https://"),
  v.maxBytes(urlMaxBytes),
);

export const oauthClientSchema = v.strictObject({
  name: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  uri: v.nullable(v.pipe(v.string(), v.trim(), httpsUrlSchema)),
  description: v.nullable(v.pipe(v.string(), v.trim())),
  redirectUris: v.pipe(v.array(redirectUriSchema), v.minLength(1)),
  jwks: jwksSchema,
});

export const oauthClientDetailSchema = v.object({
  clientId: v.string(),
  name: v.string(),
  uri: v.nullable(v.string()),
  description: v.nullable(v.string()),
  redirectUris: v.array(v.string()),
  jwks: jwksSchema,
});

export const oauthClientListSchema = v.object({
  clients: v.array(oauthClientDetailSchema),
});

export type OAuthClientInput = v.InferInput<typeof oauthClientSchema>;
export type OAuthClientDetail = v.InferOutput<typeof oauthClientDetailSchema>;
