import { oauthClientLimitPerUser } from "../../../shared/constants";
import { defineMessages } from "../../lib/i18n/define-messages";

/**
 * 「開発者向け」画面の文言。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */
export const developerMessages = defineMessages({
  ja: {
    title: "開発者向け",
    intro: "自分のアプリをOAuthクライアントとして登録し、Accountsと連携できるようにします。",
    clientListTitle: "OAuthクライアント",
    noClients: "登録済みのクライアントはありません。",
    createClient: "新規登録",
    clientLimitReached: `登録できるクライアントは${oauthClientLimitPerUser}件までです。新規登録するには、不要なクライアントを削除してください。`,
    selectClientPrompt: "一覧からクライアントを選択するか、新規登録してください。",
    newClientTitle: "新規登録",
    appInfoTitle: "アプリ情報",
    connectionTitle: "接続情報",
    nameLabel: "アプリ名",
    nameHint: "連携・同意の画面で利用者に表示します。",
    uriLabel: "紹介URL",
    uriHint: "アプリを紹介するページのURLです（任意）。",
    descriptionLabel: "説明文",
    descriptionHint: "アプリの説明です（任意）。",
    redirectUrisLabel: "リダイレクトURL",
    redirectUrisHint:
      "認証・同意の後に利用者を戻すURLです。HTTPSのURL、またはローカル開発用にlocalhost・127.0.0.1・[::1]のHTTPのURLを登録できます。",
    redirectUriLabel: (position: number) => `リダイレクトURL ${position}`,
    addRedirectUri: "リダイレクトURLを追加",
    removeRedirectUri: (position: number) => `リダイレクトURL ${position}を削除`,
    remove: "削除",
    clientIdLabel: "Client ID",
    clientIdPending: "登録すると発行されます。",
    copyClientId: "Client IDをコピー",
    jwksLabel: "公開鍵（JWK Set）",
    jwksHint:
      'private_key_jwtで使う公開鍵を {"keys":[...]} 形式のJSONで入力します。鍵を切り替えるときは、新旧の鍵を併記して保存してから旧鍵を外してください。',
    required: "入力してください。",
    invalidUrl: "URLの形式で入力してください。",
    invalidRedirectUri:
      "HTTPSのURL、またはlocalhost・127.0.0.1・[::1]のHTTPのURLを、#以降を付けずに入力してください。",
    invalidJson: "JSONの構文が正しくありません。",
    invalidKeys: '"keys" に1件以上の鍵（ktyを含むJWK）を入れてください。',
    created: "登録しました。",
    deleted: "削除しました。",
    deleteClient: "削除",
    deleting: "削除中…",
    deleteTitle: "このクライアントを削除しますか？",
    deleteDescription:
      "削除すると、このクライアントを使った連携・ログインができなくなり、発行済みのトークンによるAPIの利用も止まります。この操作は元に戻せません。",
    docsTitle: "APIドキュメント",
    docsIntro: "Accounts APIとBetter Auth APIの仕様をOpenAPIで確認できます。",
    accountsApiDocs: "Accounts API（OpenAPI）",
    authApiDocs: "Better Auth API（OpenAPI）",
    codeMessages: {
      CLIENT_LIMIT_REACHED: `登録できるクライアントは${oauthClientLimitPerUser}件までです。不要なクライアントを削除してから登録してください。`,
      CLIENT_KEY_SAVE_FAILED:
        "アプリ情報とリダイレクトURLは更新しましたが、公開鍵を保存できませんでした。同じ内容で再度保存すると反映されます。",
      MISSING_REQUIRED_FIELD: "必須の項目がありません。表示された項目を確認してください。",
      INVALID_TYPE: "値の型が正しくありません。表示された項目を確認してください。",
      INVALID_VALUE: "値が条件を満たしていません。表示された項目を確認してください。",
      UNKNOWN_FIELD: "定義されていない項目があります。",
    } as Partial<Record<string, string>>,
  },
  en: {
    title: "Developers",
    intro: "Register your app as an OAuth client so that it can connect with Accounts.",
    clientListTitle: "OAuth clients",
    noClients: "No clients are registered.",
    createClient: "New client",
    clientLimitReached: `You can register up to ${oauthClientLimitPerUser} clients. Delete a client you no longer need to register a new one.`,
    selectClientPrompt: "Select a client from the list, or register a new one.",
    newClientTitle: "New client",
    appInfoTitle: "App information",
    connectionTitle: "Connection",
    nameLabel: "App name",
    nameHint: "Shown to users on the connection and consent screens.",
    uriLabel: "Homepage URL",
    uriHint: "URL of a page that introduces your app (optional).",
    descriptionLabel: "Description",
    descriptionHint: "A description of your app (optional).",
    redirectUrisLabel: "Redirect URLs",
    redirectUrisHint:
      "Where users return after authentication and consent. Use HTTPS, or HTTP on localhost, 127.0.0.1 or [::1] for local development.",
    redirectUriLabel: (position: number) => `Redirect URL ${position}`,
    addRedirectUri: "Add redirect URL",
    removeRedirectUri: (position: number) => `Remove redirect URL ${position}`,
    remove: "Remove",
    clientIdLabel: "Client ID",
    clientIdPending: "Issued after registration.",
    copyClientId: "Copy Client ID",
    jwksLabel: "Public keys (JWK Set)",
    jwksHint:
      'Enter the public keys for private_key_jwt as JSON in the {"keys":[...]} format. To rotate keys, save both the old and new keys first, then remove the old key.',
    required: "This field is required.",
    invalidUrl: "Enter a valid URL.",
    invalidRedirectUri: "Enter an HTTPS URL, or an HTTP URL on localhost, 127.0.0.1 or [::1], without a fragment (#).",
    invalidJson: "The JSON syntax is invalid.",
    invalidKeys: 'Put at least one key (a JWK with "kty") in "keys".',
    created: "Registered.",
    deleted: "Deleted.",
    deleteClient: "Delete",
    deleting: "Deleting…",
    deleteTitle: "Delete this client?",
    deleteDescription:
      "After deletion, this client can no longer be used to connect or sign in, and API access with its issued tokens stops. This cannot be undone.",
    docsTitle: "API documentation",
    docsIntro: "See the OpenAPI documents for the Accounts API and the Better Auth API.",
    accountsApiDocs: "Accounts API (OpenAPI)",
    authApiDocs: "Better Auth API (OpenAPI)",
    codeMessages: {
      CLIENT_LIMIT_REACHED: `You can register up to ${oauthClientLimitPerUser} clients. Delete a client you no longer need, then try again.`,
      CLIENT_KEY_SAVE_FAILED:
        "The app information and redirect URLs were updated, but the public keys could not be saved. Save again with the same content to apply them.",
      MISSING_REQUIRED_FIELD: "A required field is missing. Please check the highlighted fields.",
      INVALID_TYPE: "A value has the wrong type. Please check the highlighted fields.",
      INVALID_VALUE: "A value does not meet the requirements. Please check the highlighted fields.",
      UNKNOWN_FIELD: "The request contains an undefined field.",
    },
  },
});

export type DeveloperMessages = (typeof developerMessages)["ja"];
