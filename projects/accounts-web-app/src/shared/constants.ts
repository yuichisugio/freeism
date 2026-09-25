/**
 * 画面とバックエンドで共有する上限値。
 * @see ../../docs/specification/v0.1/main.ja.md
 * @see ../../docs/specification/v0.1/verify-url.ja.md
 */

/**
 * 本人が保持できる`kind='url'`の識別子の上限。
 * 本人が登録したURL、証明で保存したプロフィールURL、OAuth由来のURLを含めて数える。
 * @see ../../docs/specification/v0.1/verify-url.ja.md
 */
export const urlIdentifierLimitPerUser = 150;

/**
 * Accountsの表示名の最大文字数。
 */
export const displayNameMaxLength = 50;

/**
 * 1ユーザーが所有できるOAuthクライアントの上限。
 */
export const oauthClientLimitPerUser = 5;

/**
 * JSONの出力・復元で扱うファイル内容の上限（5MiB）。
 */
export const jsonFileMaxBytes = 5_242_880;

/**
 * 正規化後のURLの上限（UTF-8のbyte数）。
 */
export const urlMaxBytes = 2048;

/**
 * 固有ID・ユーザー名の上限（UTF-8のbyte数）。
 */
export const identifierValueMaxBytes = 256;

/**
 * 外部アカウントの表示名・連携先クライアント名など、表示用の文字列の上限（UTF-8のbyte数）。
 */
export const displayTextMaxBytes = 256;

/**
 * バックアップJSONの`externalAccounts`の上限。
 */
export const backupExternalAccountLimit = 300;

/**
 * バックアップJSONの各アカウントの`identifiers`・`verifications`・`verifications[].identifiers`の上限。
 */
export const backupAccountItemLimit = 20;

/**
 * バックアップJSONの`clientConsents`の上限。
 */
export const backupClientConsentLimit = 50;
