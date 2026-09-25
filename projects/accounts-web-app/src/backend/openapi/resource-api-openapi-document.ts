import { toJsonSchemaDefs, type JsonSchema } from "@valibot/to-json-schema";

import { resolveIdentifierLimit } from "../../shared/constants";
import { externalIdentifierSchema } from "../../shared/schemas/identifier-schema";
import {
  externalAccountListRequestSchema,
  externalAccountListResponseSchema,
  providedExternalAccountSchema,
  providedVerificationSchema,
  resolveIdentifierSchema,
  resolveRequestSchema,
  resolveResponseSchema,
  resolveResultSchema,
  resourceApiErrorResponseSchema,
  resourceApiErrorSchema,
} from "../../shared/schemas/resource-api-schema";
import { createResourceApiIdentifier, identitiesReadScope } from "../auth/create-auth";

/**
 * Accounts資源API（`/api/v1`）のOpenAPI 3.2.1文書。
 * 入出力は資源APIが検査に使う共有のValibot schemaから`@valibot/to-json-schema`で変換する。
 * Better Authの認証API（Open APIプラグインが生成するOpenAPI 3.1.1）とは別の文書として配信する。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./resource-api-openapi-document.test.ts
 */

// --------------------------------------------------
// schema
// --------------------------------------------------

/**
 * `components.schemas`へ載せる共有schemaと、その名前。
 */
const sharedSchemas = {
  ResourceApiError: resourceApiErrorSchema,
  ResourceApiErrorResponse: resourceApiErrorResponseSchema,
  ExternalIdentifier: externalIdentifierSchema,
  ProvidedVerification: providedVerificationSchema,
  ProvidedExternalAccount: providedExternalAccountSchema,
  ExternalAccountListRequest: externalAccountListRequestSchema,
  ExternalAccountListResponse: externalAccountListResponseSchema,
  ResolveIdentifier: resolveIdentifierSchema,
  ResolveRequest: resolveRequestSchema,
  ResolveResult: resolveResultSchema,
  ResolveResponse: resolveResponseSchema,
};

type SchemaName = keyof typeof sharedSchemas;

/**
 * `components.schemas`の定義への参照を作る。
 */
function schemaRef(name: SchemaName) {
  return { $ref: `#/components/schemas/${name}` };
}

/**
 * 共有schemaをOpenAPI 3.2の既定の方言（JSON Schema 2020-12）へ変換する。
 * byte数の上限はJSON Schemaで表せないため変換から外し、各項目の説明で示す。
 * 照合の各要素は要求全体とは別に検査するため、要求schemaでは`unknown`だが、文書では識別子のschemaを示す。
 */
function convertSharedSchemas(): Record<SchemaName, JsonSchema> {
  const schemas = toJsonSchemaDefs(sharedSchemas, {
    target: "draft-2020-12",
    ignoreActions: ["max_bytes"],
    overrideRef: ({ referenceId }) => schemaRef(referenceId as SchemaName).$ref,
  });
  return {
    ...schemas,
    ResolveRequest: {
      ...schemas.ResolveRequest,
      properties: {
        identifiers: {
          type: "array",
          maxItems: resolveIdentifierLimit,
          items: schemaRef("ResolveIdentifier"),
          description: `Up to ${resolveIdentifierLimit} identifiers. Each element is validated separately and reported in its own result. URLs are limited to 2,048 bytes after normalization; account IDs and usernames to 256 bytes.`,
        },
      },
    },
  };
}

// --------------------------------------------------
// 応答
// --------------------------------------------------

const wwwAuthenticateHeader = {
  "WWW-Authenticate": {
    description: "The challenge from the standard DPoP access token verification.",
    schema: { type: "string" },
  },
};

/**
 * JSON bodyを持つ応答の定義を作る。
 */
function jsonResponse(description: string, schema: object, headers?: object) {
  return {
    description,
    ...(headers === undefined ? {} : { headers }),
    content: { "application/json": { schema } },
  };
}

/**
 * 要求全体の失敗（最上位の`errors`）の応答の定義を作る。
 */
function errorResponse(description: string, headers?: object) {
  return jsonResponse(description, schemaRef("ResourceApiErrorResponse"), headers);
}

/**
 * 一覧取得・照合で共通の、要求全体に対する失敗応答。
 */
const commonErrorResponses = {
  "401": errorResponse(
    "`UNAUTHORIZED`: the access token or DPoP proof is missing, invalid or expired, or the client has been deleted.",
    wwwAuthenticateHeader,
  ),
  "403": errorResponse(
    "`INSUFFICIENT_SCOPE`: the access token does not have `identities:read`.",
    wwwAuthenticateHeader,
  ),
};

const bodyErrorResponses = {
  "413": errorResponse("`REQUEST_TOO_LARGE`: the request body exceeds 5 MiB (5,242,880 bytes)."),
  "415": errorResponse("`UNSUPPORTED_MEDIA_TYPE`: `Content-Type` is not JSON."),
  "429": {
    description:
      "Rate limited by the Cloudflare WAF. The body does not follow the error format of this API.",
  },
  "500": errorResponse("`INTERNAL_ERROR`: the server failed to process the request."),
};

/**
 * 照合のHTTP 400の例。
 * 入力ごとの不備は`results`、要求全体の不備は最上位の`errors`で返す。
 */
const resolveBadRequestExamples = {
  invalidInput: {
    summary: "An identifier is invalid (results)",
    value: {
      accountsOrigin: "https://accounts.freeism.app",
      results: [
        {
          index: 0,
          identifier: { type: "provider_account", provider: "google" },
          status: "invalid_input",
          accountsUserId: null,
          errors: [
            {
              code: "MISSING_REQUIRED_FIELD",
              message: "accountId is required.",
              path: ["identifiers", 0, "accountId"],
            },
          ],
        },
      ],
    },
  },
  invalidRequest: {
    summary: "The whole request is invalid (errors)",
    value: {
      errors: [{ code: "UNKNOWN_FIELD", message: "Unknown field.", path: ["limit"] }],
    },
  },
};

// --------------------------------------------------
// 文書
// --------------------------------------------------

/**
 * 資源APIのOpenAPI文書を作る。
 * @param accountsOrigin 配信するAccountsのorigin（`servers`とtoken endpointに使う）
 */
export function createResourceApiOpenApiDocument(accountsOrigin: string) {
  const dpopParameter = {
    name: "DPoP",
    in: "header",
    required: true,
    description:
      "A DPoP proof JWT (RFC 9449) created for each request, with `htm: QUERY`, `htu` set to the request URL and `ath` set to the hash of the access token.",
    schema: { type: "string" },
  };
  const security = [{ accountsClient: [identitiesReadScope] }];

  return {
    openapi: "3.2.1",
    info: {
      title: "Accounts API",
      version: "0.1.0",
      description:
        "Lists the external accounts that a user has chosen to provide to the calling client, and resolves identifiers to Accounts users. Both operations use the HTTP `QUERY` method with a JSON body. The OAuth and OpenID Connect endpoints are described in the Better Auth API reference.",
    },
    servers: [{ url: createResourceApiIdentifier(accountsOrigin) }],
    paths: {
      "/external-accounts": {
        query: {
          operationId: "listExternalAccounts",
          summary: "List the external accounts provided to this client",
          description:
            "Returns every external account that the user has chosen to provide to the calling client. A missing user and a user without consent to this client return the same 404.",
          security,
          parameters: [dpopParameter],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: schemaRef("ExternalAccountListRequest") },
            },
          },
          responses: {
            "200": jsonResponse("The provided external accounts.", schemaRef("ExternalAccountListResponse")),
            "400": errorResponse(
              "The whole request is invalid: `INVALID_JSON`, `MISSING_REQUIRED_FIELD` (including a missing `Content-Type`), `INVALID_TYPE`, `INVALID_VALUE` or `UNKNOWN_FIELD`.",
            ),
            ...commonErrorResponses,
            "404": errorResponse(
              "`NOT_FOUND`: the user does not exist or has not consented to provide information to this client.",
            ),
            ...bodyErrorResponses,
          },
        },
      },
      "/identities/resolve": {
        query: {
          operationId: "resolveIdentities",
          summary: "Resolve identifiers to Accounts users",
          description:
            "Resolves each identifier with the stored verified identifiers and the current consent and visibility for this client. Results keep the input order. An unregistered identifier and one not provided to this client both return `no_match`.",
          security,
          parameters: [dpopParameter],
          requestBody: {
            required: true,
            content: { "application/json": { schema: schemaRef("ResolveRequest") } },
          },
          responses: {
            "200": jsonResponse(
              "Every identifier was valid. An empty `identifiers` returns empty `results`.",
              schemaRef("ResolveResponse"),
            ),
            "400": {
              description: `Either at least one identifier is invalid (\`results\` with \`invalid_input\`, including the results of the valid identifiers), or the whole request is invalid (top-level \`errors\`: \`INVALID_JSON\`, \`MISSING_REQUIRED_FIELD\`, \`INVALID_TYPE\`, \`INVALID_VALUE\` including more than ${resolveIdentifierLimit} identifiers, or \`UNKNOWN_FIELD\`).`,
              content: {
                "application/json": {
                  schema: {
                    oneOf: [schemaRef("ResolveResponse"), schemaRef("ResourceApiErrorResponse")],
                  },
                  examples: resolveBadRequestExamples,
                },
              },
            },
            ...commonErrorResponses,
            ...bodyErrorResponses,
          },
        },
      },
    },
    components: {
      schemas: convertSharedSchemas(),
      securitySchemes: {
        accountsClient: {
          type: "oauth2",
          description:
            "A client access token from the `client_credentials` grant. Authenticate the client with `private_key_jwt` (RFC 7523) and send a DPoP proof to bind the token (RFC 9449). Send the token as `Authorization: DPoP <token>` together with a new `DPoP` proof for each request. Request the token with `resource` set to the server URL of this document.",
          oauth2MetadataUrl: `${accountsOrigin}/.well-known/oauth-authorization-server`,
          flows: {
            clientCredentials: {
              tokenUrl: `${accountsOrigin}/api/auth/oauth2/token`,
              scopes: {
                [identitiesReadScope]:
                  "List provided external accounts and resolve identifiers.",
              },
            },
          },
        },
      },
    },
  };
}
