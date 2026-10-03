import { describe, expect, it } from "vitest";

import { createResourceApiOpenApiDocument } from "./resource-api-openapi-document";

const accountsOrigin = "https://accounts.example";

/**
 * 文書内の`$ref`をすべて集める。
 */
function collectRefs(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectRefs);
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    key === "$ref" && typeof child === "string" ? [child] : collectRefs(child),
  );
}

describe("createResourceApiOpenApiDocument", () => {
  const document = createResourceApiOpenApiDocument(accountsOrigin);

  it("OpenAPI 3.2.1で、一覧取得と照合をQUERY操作として記述する", () => {
    expect(document.openapi).toBe("3.2.1");
    expect(document.servers).toEqual([{ url: `${accountsOrigin}/api/v1` }]);
    expect(Object.keys(document.paths)).toEqual(["/external-accounts", "/identities/resolve"]);
    for (const pathItem of Object.values(document.paths)) {
      expect(Object.keys(pathItem)).toEqual(["query"]);
    }
  });

  it("要求bodyを共有schemaから変換し、照合の各要素は識別子のschemaで示す", () => {
    const { schemas } = document.components;

    expect(schemas.ExternalAccountListRequest).toMatchObject({
      type: "object",
      required: ["accountsUserId"],
      additionalProperties: false,
    });
    expect(schemas.ResolveRequest).toMatchObject({
      properties: {
        identifiers: {
          type: "array",
          maxItems: 1000,
          items: { $ref: "#/components/schemas/ResolveIdentifier" },
        },
      },
      additionalProperties: false,
    });
    expect(schemas.ResolveResult).toMatchObject({
      properties: { status: { enum: ["matched", "no_match", "invalid_input"] } },
    });
  });

  it("DPoPで送るClient CredentialsのAccess Tokenとidentities:readを要求する", () => {
    const scheme = document.components.securitySchemes.accountsClient;

    expect(scheme).toMatchObject({
      type: "oauth2",
      oauth2MetadataUrl: `${accountsOrigin}/.well-known/oauth-authorization-server`,
      flows: {
        clientCredentials: {
          tokenUrl: `${accountsOrigin}/api/auth/oauth2/token`,
          scopes: { "identities:read": expect.any(String) },
        },
      },
    });
    expect(scheme.description).toContain("private_key_jwt");
    expect(scheme.description).toContain("DPoP");
    for (const pathItem of Object.values(document.paths)) {
      expect(pathItem.query.security).toEqual([{ accountsClient: ["identities:read"] }]);
      expect(pathItem.query.parameters).toEqual([
        expect.objectContaining({ name: "DPoP", in: "header", required: true }),
      ]);
    }
  });

  it("照合のHTTP 400は、入力ごとのresultsと要求全体のerrorsの2形式を区別する", () => {
    const resolve = document.paths["/identities/resolve"].query;
    const list = document.paths["/external-accounts"].query;

    expect(resolve.responses["400"].content["application/json"].schema).toEqual({
      oneOf: [
        { $ref: "#/components/schemas/ResolveResponse" },
        { $ref: "#/components/schemas/ResourceApiErrorResponse" },
      ],
    });
    expect(list.responses["400"].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/ResourceApiErrorResponse",
    });
    expect(Object.keys(resolve.responses)).toEqual([
      "200",
      "400",
      "401",
      "403",
      "413",
      "415",
      "429",
      "500",
    ]);
    expect(Object.keys(list.responses)).toEqual([
      "200",
      "400",
      "401",
      "403",
      "404",
      "413",
      "415",
      "429",
      "500",
    ]);
    expect(resolve.responses["401"].headers).toHaveProperty("WWW-Authenticate");
  });

  it("文書内の参照はすべてcomponentsに定義がある", () => {
    const refs = collectRefs(document);
    const schemaNames = Object.keys(document.components.schemas);

    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref).toMatch(/^#\/components\/schemas\//);
      expect(schemaNames).toContain(ref.replace("#/components/schemas/", ""));
    }
  });
});
