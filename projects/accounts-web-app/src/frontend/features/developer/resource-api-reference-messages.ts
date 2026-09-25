import { defineMessages } from "../../lib/i18n/define-messages";

/**
 * 「開発者向け」画面のAccounts API（資源API）の仕様表示の文言。
 */
export const resourceApiReferenceMessages = defineMessages({
  ja: {
    title: "Accounts APIの仕様",
    description:
      "連携アカウントの一覧取得と識別子の照合は、JSON bodyで条件を送るHTTP QUERYで呼び出します。完全な定義はOpenAPI 3.2.1のJSONで配信しています。OAuth・OpenID Connectのエンドポイントは、Better Auth APIのドキュメントを参照してください。",
    loadFailed: "Accounts APIの仕様を読み込めませんでした。画面を再読み込みしてください。",
    request: "要求body",
    responses: "応答",
    noBody: "bodyなし",
    schemas: "スキーマ",
  },
  en: {
    title: "Accounts API reference",
    description:
      "Listing external accounts and resolving identifiers use the HTTP QUERY method with a JSON body. The complete definition is served as OpenAPI 3.2.1 JSON. For the OAuth and OpenID Connect endpoints, see the Better Auth API documentation.",
    loadFailed: "Could not load the Accounts API reference. Please reload the page.",
    request: "Request body",
    responses: "Responses",
    noBody: "No body",
    schemas: "Schemas",
  },
});
