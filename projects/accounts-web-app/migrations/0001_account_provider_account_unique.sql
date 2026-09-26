-- Better Authの生成schemaに無い`account(provider_id, account_id)`の一意性を加える。
-- 生成schemaは手編集しないため、主仕様「認証ライブラリとの分担」の一意制約をこのmigrationで作る。
CREATE UNIQUE INDEX `account_provider_account_unique` ON `account` (`provider_id`,`account_id`);
