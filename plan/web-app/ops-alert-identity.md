# Points／Markets 運用アラートの識別

## 仕様

- 監視アラートは `type:resourceId` または `signal:resourceId` を一意キーにして、同じ状態を繰り返し観測しても同じ行を更新する。
- 監視対象のリソース ID はサーバーが生成する内部 ID とする。運用通知にはアラートキーを含める。
- 構造化ログにはリソース ID を含めない。Analytics Engine の index には固定された event 名を使い、個別のリソース ID を含めない。
- Points の `ops_alert` はアラートキーを保持し、`resource_id_hash` 列を持たない。列を削除する D1 migration を新 Worker のデプロイ前に適用する。
- 既存の保存済みアラートは変換しない。切替後の最初の監視で旧キーの OPEN アラートが RESOLVED、新キーのアラートが OPEN となり、通知が発生し得る。

## 検証

1. 両アプリのアラートの生成、重複判定、通知、ログ、メトリクスの関連テストを更新する。
2. Points の D1 migration で `resource_id_hash` 列を削除し、既存のアラートデータと通知フローが扱えることを確認する。
3. Worker テスト、型検査、差分チェックを実行する。
