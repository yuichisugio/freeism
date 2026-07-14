import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const STOP_CODE = "BETTER_AUTH_STANDARD_OAUTH_FEASIBILITY_UNPROVEN" as const;
const OFFICIAL_DOCUMENTATION = [
  "https://www.better-auth.com/docs/plugins/oauth-provider",
  "https://better-auth.com/docs/guides/1-7-upgrade-guide",
] as const;

type Check = {
  supported: boolean;
  evidence: string[];
};

export type BetterAuthOAuthFeasibilityReport = {
  schemaVersion: 1;
  generatedAt: string;
  package: {
    name: string;
    version: string;
    lockfileIntegritySha512?: string;
    inspectedContentSha256: string;
  };
  documentationUrls: readonly string[];
  inspectedFiles: string[];
  supported: {
    opaqueAccessTokens: Check;
    clientCredentialsWithoutUser: Check;
    confidentialRemoteIntrospection: Check;
    separateClientScopeAllowlists: Check;
    standardRevocation: Check;
    pairwiseUserSubjectAtIntrospection: Check;
    idTokenRejectedAsResourceBearer: Check;
  };
  acceptedDesign: {
    userClient: "separate-confidential-client";
    m2mClient: "separate-confidential-client";
    settlementClient: "separate-confidential-client";
    introspection: "standard-confidential-remote";
    consistency: "pending-confirm-revocation-outbox";
  };
  avoidedUnsupportedCapabilities: string[];
  result: "PASS" | "FAIL";
  stopCode?: typeof STOP_CODE;
};

type PackageMetadata = {
  name: string;
  version: string;
  exports: Record<string, { types?: string; default?: string }>;
};

function section(source: string, start: string, end: string): string {
  const startAt = source.indexOf(start);
  if (startAt < 0) return "";
  const endAt = source.indexOf(end, startAt + start.length);
  return source.slice(startAt, endAt < 0 ? source.length : endAt);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findPackageRoot(): Promise<string> {
  const require = createRequire(import.meta.url);
  const entrypoint = require.resolve("@better-auth/oauth-provider");
  return dirname(dirname(entrypoint));
}

export async function inspectBetterAuthOAuthFeasibility(): Promise<BetterAuthOAuthFeasibilityReport> {
  const packageRoot = await findPackageRoot();
  const packageJsonPath = join(packageRoot, "package.json");
  const packageJson = await readFile(packageJsonPath, "utf8");
  const metadata = JSON.parse(packageJson) as PackageMetadata;
  const providerRequire = createRequire(packageJsonPath);
  const coreOAuth2Directory = dirname(providerRequire.resolve("@better-auth/core/oauth2"));
  const coreOAuth2Files = ["index.mjs", "verify.mjs"];
  const repositoryRoot = resolve(dirname(import.meta.filename), "../../..");
  const lockfile = await readFile(join(repositoryRoot, "pnpm-lock.yaml"), "utf8");
  const lockfileIntegritySha512 = lockfile.match(
    new RegExp(
      `'${escapeRegExp(metadata.name)}@${escapeRegExp(metadata.version)}':\\n` +
        "    resolution: \\{integrity: (sha512-[^}]+)\\}",
    ),
  )?.[1];
  const distFiles = (await readdir(join(packageRoot, "dist"))).sort();
  const typeFiles = distFiles.filter((file) => file.endsWith(".d.mts"));
  const runtimeFiles = distFiles.filter((file) => file.endsWith(".mjs"));
  const inspectedRelativeFiles = [
    "package.json",
    ...typeFiles.map((file) => `dist/${file}`),
    ...runtimeFiles.map((file) => `dist/${file}`),
    ...coreOAuth2Files.map((file) => `@better-auth/core/dist/oauth2/${file}`),
  ];
  const providerContents = await Promise.all(
    [
      "package.json",
      ...typeFiles.map((file) => `dist/${file}`),
      ...runtimeFiles.map((file) => `dist/${file}`),
    ].map((file) => readFile(join(packageRoot, file), "utf8")),
  );
  const coreOAuth2Contents = await Promise.all(
    coreOAuth2Files.map((file) => readFile(join(coreOAuth2Directory, file), "utf8")),
  );
  const contents = [...providerContents, ...coreOAuth2Contents];
  const typeSource = contents
    .filter((_, index) => inspectedRelativeFiles[index]?.endsWith(".d.mts"))
    .join("\n");
  const runtimeSource = contents
    .slice(0, providerContents.length)
    .filter((_, index) => inspectedRelativeFiles[index]?.endsWith(".mjs"))
    .join("\n");
  const coreOAuth2Source = coreOAuth2Contents.join("\n");

  const clientSchema = section(
    typeSource,
    "interface SchemaClient",
    "interface OAuthOpaqueAccessToken",
  );
  const resourceTypes = section(typeSource, "type ResourceClientAuth", "//#endregion");
  const opaqueAccessTokens =
    typeSource.includes("disableJwtPlugin?: boolean") &&
    runtimeSource.includes("const isJwtAccessToken = audienceClaim && !opts.disableJwtPlugin");
  const clientCredentialsWithoutUser =
    typeSource.includes("Undefined for `client_credentials` (M2M, no user).") &&
    runtimeSource.includes('grantType: "client_credentials"') &&
    !section(
      runtimeSource,
      "async function handleClientCredentialsGrant",
      "async function handleRefreshTokenGrant",
    ).includes("user,");
  const confidentialRemoteIntrospection =
    resourceTypes.includes("remoteVerify?: VerifyAccessTokenRemote") &&
    resourceTypes.includes("introspectUrl: string") &&
    resourceTypes.includes("clientId: string") &&
    resourceTypes.includes("clientSecret: string") &&
    coreOAuth2Source.includes("fetchRefusingRedirects(opts.remoteVerify.introspectUrl") &&
    coreOAuth2Source.includes("client_secret: opts.remoteVerify.clientSecret");
  const separateClientScopeAllowlists =
    clientSchema.includes("scopes?: Scopes") && clientSchema.includes("grantTypes?: GrantType[]");
  const standardRevocation =
    typeSource.includes('StrictEndpoint<"/oauth2/revoke"') &&
    runtimeSource.includes('createOAuthEndpoint("/oauth2/revoke"');
  const pairwiseUserSubjectAtIntrospection =
    typeSource.includes("pairwiseSecret?: string") &&
    runtimeSource.includes("async function resolveIntrospectionSub") &&
    runtimeSource.includes("resolveSubjectIdentifier(payload.sub, issuingClient, opts)");
  const idTokenRejectedAsResourceBearer =
    runtimeSource.includes('setProtectedHeader({ alg: "HS256" })') &&
    runtimeSource.includes("async function validateOpaqueAccessToken") &&
    coreOAuth2Source.includes('token_type_hint: "access_token"');

  const supportedChecks = {
    opaqueAccessTokens,
    clientCredentialsWithoutUser,
    confidentialRemoteIntrospection,
    separateClientScopeAllowlists,
    standardRevocation,
    pairwiseUserSubjectAtIntrospection,
    idTokenRejectedAsResourceBearer,
  };
  const result = Object.values(supportedChecks).every(Boolean) ? "PASS" : "FAIL";
  const inspectedContentSha256 = createHash("sha256").update(contents.join("\n")).digest("hex");

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    package: {
      name: metadata.name,
      version: metadata.version,
      ...(lockfileIntegritySha512 ? { lockfileIntegritySha512 } : {}),
      inspectedContentSha256,
    },
    documentationUrls: OFFICIAL_DOCUMENTATION,
    inspectedFiles: inspectedRelativeFiles,
    supported: {
      opaqueAccessTokens: {
        supported: opaqueAccessTokens,
        evidence: [
          "OAuthOptions exposes disableJwtPlugin and the runtime selects opaque access-token storage when enabled.",
        ],
      },
      clientCredentialsWithoutUser: {
        supported: clientCredentialsWithoutUser,
        evidence: [
          "The public callback contract marks user as undefined for client_credentials, and the built-in grant issues without a user object.",
        ],
      },
      confidentialRemoteIntrospection: {
        supported: confidentialRemoteIntrospection,
        evidence: [
          "The public Resource Client exposes remoteVerify with an introspection URL and confidential-client authentication.",
        ],
      },
      separateClientScopeAllowlists: {
        supported: separateClientScopeAllowlists,
        evidence: [
          "Each registered client has its own scopes and grantTypes fields, so user and M2M clients can use disjoint allowlists.",
        ],
      },
      standardRevocation: {
        supported: standardRevocation,
        evidence: ["The public OAuth Provider exposes the standard revocation endpoint."],
      },
      pairwiseUserSubjectAtIntrospection: {
        supported: pairwiseUserSubjectAtIntrospection,
        evidence: [
          "The provider resolves the user subject through pairwiseSecret before returning active introspection data.",
        ],
      },
      idTokenRejectedAsResourceBearer: {
        supported: idTokenRejectedAsResourceBearer,
        evidence: [
          "ID tokens use the confidential-client HS256 path, while Resource Client verification asks introspection for an access token.",
        ],
      },
    },
    acceptedDesign: {
      userClient: "separate-confidential-client",
      m2mClient: "separate-confidential-client",
      settlementClient: "separate-confidential-client",
      introspection: "standard-confidential-remote",
      consistency: "pending-confirm-revocation-outbox",
    },
    avoidedUnsupportedCapabilities: [
      "grant-specific scope allowlists inside one client",
      "auth-only in-process opaque introspection",
      "application transaction enlistment for authorization codes",
      "application transaction enlistment for token families",
    ],
    result,
    ...(result === "FAIL" ? { stopCode: STOP_CODE } : {}),
  };
}

async function main(): Promise<void> {
  const report = await inspectBetterAuthOAuthFeasibility();
  const repositoryRoot = resolve(dirname(import.meta.filename), "../../..");
  const artifactPath = join(
    repositoryRoot,
    "artifacts/web-app/better-auth-oauth-feasibility",
    `${report.package.version}.json`,
  );
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`Wrote ${relative(repositoryRoot, artifactPath)}\n`);
  if (report.result === "FAIL") {
    process.stderr.write(`${STOP_CODE}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
