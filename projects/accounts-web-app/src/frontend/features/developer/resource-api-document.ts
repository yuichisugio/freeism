import * as v from "valibot";

/**
 * 「開発者向け」画面で要約表示する、Accounts資源APIのOpenAPI文書。
 * 文書は`/api/v1/openapi.json`が返し、画面は見出し・経路・要求と応答のschemaだけを読む。
 * @see ../../../backend/openapi/resource-api-openapi-document.ts
 * @see ./resource-api-document.test.ts
 */

/**
 * 資源APIのOpenAPI文書のパス。
 */
export const resourceApiDocumentPath = "/api/v1/openapi.json";

const mediaTypesSchema = v.record(v.string(), v.object({ schema: v.optional(v.unknown()) }));

const operationSchema = v.object({
  summary: v.optional(v.string()),
  description: v.optional(v.string()),
  requestBody: v.optional(v.object({ content: mediaTypesSchema })),
  responses: v.record(
    v.string(),
    v.object({ description: v.string(), content: v.optional(mediaTypesSchema) }),
  ),
});

/**
 * 画面が読むOpenAPI文書の部分。
 */
export const resourceApiDocumentSchema = v.object({
  openapi: v.string(),
  info: v.object({ title: v.string(), version: v.string() }),
  servers: v.pipe(v.array(v.object({ url: v.string() })), v.minLength(1)),
  paths: v.record(v.string(), v.record(v.string(), operationSchema)),
  components: v.object({ schemas: v.record(v.string(), v.unknown()) }),
});

/**
 * 1操作の要約。
 * schemaは表示用に整形したJSONで、参照先は`schemas`の名前で示される。
 */
export type ResourceApiOperation = {
  method: string;
  path: string;
  summary: string;
  description: string | null;
  requestSchema: string | null;
  responses: { status: string; description: string; schema: string | null }[];
};

/**
 * 画面に表示する文書の要約。
 */
export type ResourceApiReference = {
  title: string;
  version: string;
  openapi: string;
  operations: ResourceApiOperation[];
  schemas: { name: string; json: string }[];
};

/**
 * JSON bodyのschemaを表示用に整形する。
 */
function formatSchema(content: v.InferOutput<typeof mediaTypesSchema> | undefined): string | null {
  const schema = content?.["application/json"]?.schema;
  return schema === undefined ? null : JSON.stringify(schema, null, 2);
}

/**
 * OpenAPI文書を、操作ごとの見出し・経路・要求と応答のschemaへまとめる。
 * 経路はサーバーURLのpathと操作のpathをつないだ値にする。
 */
export function summarizeResourceApiDocument(
  document: v.InferOutput<typeof resourceApiDocumentSchema>,
): ResourceApiReference {
  const basePath = new URL(document.servers[0]?.url ?? "/", "https://accounts.invalid").pathname;
  const operations = Object.entries(document.paths).flatMap(([path, pathItem]) =>
    Object.entries(pathItem).map(([method, operation]) => ({
      method: method.toUpperCase(),
      path: `${basePath.replace(/\/$/, "")}${path}`,
      summary: operation.summary ?? path,
      description: operation.description ?? null,
      requestSchema: formatSchema(operation.requestBody?.content),
      responses: Object.entries(operation.responses).map(([status, response]) => ({
        status,
        description: response.description,
        schema: formatSchema(response.content),
      })),
    })),
  );

  return {
    title: document.info.title,
    version: document.info.version,
    openapi: document.openapi,
    operations,
    schemas: Object.entries(document.components.schemas).map(([name, schema]) => ({
      name,
      json: JSON.stringify(schema, null, 2),
    })),
  };
}
