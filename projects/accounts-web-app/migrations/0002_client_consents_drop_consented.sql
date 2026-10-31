-- 情報提供同意のフラグを廃止し、`client_consents`を提供先の記録にする。
-- 提供しているかは、公開選択と有効な識別子から判定する。
DROP INDEX `client_consents_client_user_consented_idx`;--> statement-breakpoint
CREATE INDEX `client_consents_client_id_idx` ON `client_consents` (`client_id`);--> statement-breakpoint
ALTER TABLE `client_consents` DROP COLUMN `consented`;