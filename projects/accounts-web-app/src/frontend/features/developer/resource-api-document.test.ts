import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { createResourceApiOpenApiDocument } from "../../../backend/openapi/resource-api-openapi-document";
import { resourceApiDocumentSchema, summarizeResourceApiDocument } from "./resource-api-document";

describe("summarizeResourceApiDocument", () => {
  const document = v.parse(
    resourceApiDocumentSchema,
    createResourceApiOpenApiDocument("https://accounts.example"),
  );

  it("QUERY操作ごとに、見出し・サーバーのpathを含む経路・要求と応答のschemaをまとめる", () => {
    const reference = summarizeResourceApiDocument(document);

    expect(reference).toMatchObject({ title: "Accounts API", openapi: "3.2.1" });
    expect(reference.operations.map(({ method, path }) => `${method} ${path}`)).toEqual([
      "QUERY /api/v1/external-accounts",
      "QUERY /api/v1/identities/resolve",
    ]);
    const [list] = reference.operations;
    expect(list?.requestSchema).toContain("#/components/schemas/ExternalAccountListRequest");
    expect(list?.responses.find(({ status }) => status === "404")).toMatchObject({
      schema: expect.stringContaining("ResourceApiErrorResponse"),
    });
    expect(list?.responses.find(({ status }) => status === "429")?.schema).toBeNull();
  });

  it("参照先のschemaを名前とJSONで返す", () => {
    const { schemas } = summarizeResourceApiDocument(document);

    expect(schemas.map(({ name }) => name)).toContain("ResolveResponse");
    expect(schemas.find(({ name }) => name === "ResolveResult")?.json).toContain("invalid_input");
  });
});
