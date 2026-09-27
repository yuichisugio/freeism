# Points OAuth クライアント管理

Points にログインした利用者は「開発者向け」画面で、自分のアプリを OAuth クライアントとして最大5件登録・更新・削除できる。Markets も同じ仕組みで登録する。入力、所有者管理、鍵の更新、削除の仕様は [Accounts v0.1 の OAuth クライアント管理](../../projects/accounts-web-app/docs/specification/v0.1/main.ja.md#oauthクライアント管理) に従う。

## 登録と更新

- 必須はアプリ名、1件以上のリダイレクト URL、`private_key_jwt` 用の公開鍵。紹介 URL は HTTPS の任意項目、説明文も任意項目とする。
- 公開鍵はインライン JWKS `{"keys":[...]}` で登録する。Client ID は Points が発行し、対応する秘密鍵は利用側のバックエンドだけが保管する。説明文は `oauthClient.metadata.description` に保存する。
- リダイレクト URL は HTTPS、または `localhost`、`127.0.0.1`、`[::1]` の HTTP を許可する。ローカル HTTP の URL を含むクライアントは `application_type: "native"`、それ以外は `"web"` とする。認可時は登録済み URL と文字列で完全一致させる。ローカル HTTP は RFC 8252 に従い、ポートだけを一致条件から除く。
- 登録は Better Auth の `adminCreateOAuthClient`、アプリ情報とリダイレクト URL の更新は `adminUpdateOAuthClient` を使う。標準更新 API が受け付けない公開鍵の更新と紹介 URL の削除は、Accounts v0.1 と同じ所有者確認・鍵検査・保存手順で行う。
- 一覧、詳細、更新、削除はいずれもログイン中の登録者本人のクライアントだけを対象とする。画面とバックエンドの両方で5件の上限を確認する。

## Markets の登録と利用

各環境の Markets は、利用者委任とM2Mに使うクライアント1件を Points の画面から登録する。`authorization_code`、`refresh_token`、`client_credentials`、必要な scope、Points API resource、link・unlinkのredirect URI を設定する。用途別 scope と resource の検査は Token 発行時と Resource API 利用時に行う。

Markets の Worker Secret は `POINTS_CLIENT_ID` と `POINTS_CLIENT_PRIVATE_KEY_JWK` の一組とする。後者は Ed25519 秘密 JWK の JSON 文字列で、公開 JWKS の `kid` と一致する。`private_key_jwt` は `iss=sub=clientId`、`aud=呼び出す Points token/introspect/revoke endpoint の絶対 URL`、約60秒の `iat`/`exp`、ランダムな `jti`、`alg=EdDSA` と登録済み `kid` を含めて署名する。秘密鍵を Points の Worker、D1、ブラウザー、ログ、成果物に渡さない。

Points は Better Auth 1.7.5 の標準 JWT Access Token を発行し、Resource API は署名・issuer・audience・期限・client・scope と連携状態を検査する。Access Token の最長有効期間は15分とする。利用者委任の `sub` は Points auth user ID、M2M の `sub` は Client ID。両者は用途別 scope と `sub` の意味で区別し、M2M で残高参照・新規予約を許可しない。Markets は `issuer + subject` を Points 利用者との連携キーとして保持する。Settlement手動retryでは同じUSER TokenでPointsの現行ADMINを照会する。

一般アプリも同じ登録方法とClient IDで利用できる。`openid profile`のみなら通常のAuthorization Code認可を利用できる。Pointsの接続が必要なscopeを使う場合は、同じClient IDのM2M Tokenでlink attemptを開始し、利用者認可後にfinalizeする。M2M Tokenには必要なscopeを明示する。

## 検証

利用者Aが登録したクライアントをBが一覧・取得・更新・削除できないこと、5件を超える登録が画面と API の両方で拒否されること、URL と JWKS の検査、公開鍵更新後の JWT client assertion、削除後の認可・Token 発行停止を確認する。Markets については linkとM2Mのscope、および共通のPoints API resourceを検証する。
