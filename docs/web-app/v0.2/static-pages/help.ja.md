# ヘルプ

Freeism v0.2は、ポイントを扱うPointsと、商材・Auctionを扱うMarketsに分かれています。

## Points

- `points.freeism.app`ではGoogleまたはGitHubでログインできます。
- メール・パスワード、Appleによるログインはありません。
- 評価軸、FIX、残高、譲渡、交換、未受領FIXを管理します。
- Accountsと情報連携し、公開を許可した外部アカウントの照合後、正負すべての未受領FIXをpreviewして一括受領します。都合のよい結果だけは選べません。

## Accountsとの連携

外部アカウントの登録・所有権証明・公開設定は `accounts.freeism.app` で管理します。Pointsへログインした後、Accountsとの情報連携を許可できます。公開設定の詳細は[Accounts v0.1仕様](../../../../projects/accounts-web-app/docs/specification/v0.1/main.ja.md)を参照してください。

## Markets

- `markets.freeism.app`ではGoogleだけでログインします。Pointsとは別アカウントです。
- ログイン後にPointsへ明示同意して1対1で連携します。
- 商材情報を含むAuction作成、入札、落札結果、proof、reviewを扱います。
- Points残高、FIX、評価軸をMarkets自身では管理しません。

## セキュリティ上の確認

Pointsのログインアカウント連携、FIX確定、未受領FIX受領、管理操作などでは、15分以内のGoogle再認証を求めることがあります。メールアドレスの一致だけでAccountを統合しません。

## 問題が起きた場合

画面に表示されたrequest ID、操作時刻、利用していたdomainを控えてください。OAuth Token、Cookie、Client Secret、CSV本文は共有しないでください。
