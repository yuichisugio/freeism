import { resolveIdentifierLimit } from "../../../shared/constants";
import { defineMessages } from "../../lib/i18n/define-messages";

/**
 * 1操作の見出し・説明と、HTTPステータスごとの応答の説明。
 */
export type ResourceApiOperationText = {
  summary: string;
  description: string;
  responses: Partial<Record<string, string>>;
};

/**
 * 一覧取得・照合で共通の応答の説明（日本語）。
 */
const commonResponsesJa = {
  "401": "`UNAUTHORIZED`: Access Token・DPoP proofが無いか、不正または期限切れです。クライアントが削除された場合も含みます。",
  "403": "`INSUFFICIENT_SCOPE`: Access Tokenに`identities:read`がありません。",
  "413": "`REQUEST_TOO_LARGE`: 要求の本文が5MiB（5,242,880 bytes）を超えています。",
  "415": "`UNSUPPORTED_MEDIA_TYPE`: `Content-Type`がJSONではありません。",
  "429": "Cloudflare WAFによる流量制限です。本文はこのAPIのエラー形式に従いません。",
  "500": "`INTERNAL_ERROR`: サーバーで処理に失敗しました。",
};

/**
 * 「開発者向け」画面のAccounts API（資源API）の仕様表示の文言。
 * OpenAPI文書の見出し・説明は英語のため、日本語の表示では`operations`の文言を`operationId`で引いて表示する。
 * 英語の表示は`operations`を持たず、OpenAPI文書の文言をそのまま表示する。
 * @see ../../backend/openapi/resource-api-openapi-document.ts
 */
export const resourceApiReferenceMessages = defineMessages({
  ja: {
    title: "Accounts APIの仕様",
    description:
      "連携アカウントの一覧取得と識別子の照合は、JSONの本文で条件を送るHTTP QUERYで呼び出します。完全な定義はOpenAPI 3.2.1のJSONで配信しています。OAuth・OpenID Connectのエンドポイントは、Better Auth APIのドキュメントを参照してください。",
    loadFailed: "Accounts APIの仕様を読み込めませんでした。画面を再読み込みしてください。",
    request: "要求の本文",
    responses: "応答",
    noBody: "本文なし",
    schemas: "スキーマ",
    operations: {
      listExternalAccounts: {
        summary: "連携先へ提供する外部アカウントを一覧で取得する",
        description:
          "利用者がこのクライアントへの提供を選んだ外部アカウントをすべて返します。存在しないユーザーと、このクライアントへの情報提供に同意していないユーザーは、同じ404を返します。",
        responses: {
          "200": "提供する外部アカウントの一覧です。",
          "400":
            "要求全体の不備です: `INVALID_JSON`・`MISSING_REQUIRED_FIELD`（`Content-Type`が無い場合を含む）・`INVALID_TYPE`・`INVALID_VALUE`・`UNKNOWN_FIELD`。",
          "404": "`NOT_FOUND`: ユーザーが存在しないか、このクライアントへの情報提供に同意していません。",
          ...commonResponsesJa,
        },
      },
      resolveIdentities: {
        summary: "識別子をAccountsユーザーへ照合する",
        description:
          "各識別子を、保存済みの証明済み識別子と、このクライアントへの現在の同意・公開設定で照合します。結果は入力の順に返します。未登録の識別子と、このクライアントへ提供していない識別子は、どちらも`no_match`を返します。",
        responses: {
          "200": "すべての識別子が有効でした。`identifiers`が空の場合は、空の`results`を返します。",
          "400": `1件以上の識別子が不正な場合（有効な識別子の結果も含め、\`results\`に\`invalid_input\`を返します）と、要求全体が不正な場合（最上位の\`errors\`: \`INVALID_JSON\`・\`MISSING_REQUIRED_FIELD\`・\`INVALID_TYPE\`・${resolveIdentifierLimit}件を超える識別子を含む\`INVALID_VALUE\`・\`UNKNOWN_FIELD\`）があります。`,
          ...commonResponsesJa,
        },
      },
    } as Partial<Record<string, ResourceApiOperationText>>,
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
    operations: {},
  },
});
