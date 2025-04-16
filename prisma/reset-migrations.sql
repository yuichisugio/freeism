-- 失敗したマイグレーションステータスをリセットするためのスクリプト
UPDATE "_prisma_migrations"
SET "applied_steps_count" = 0,
    "rolled_back" = TRUE,
    "rolled_back_at" = NOW()
WHERE "migration_name" = '20250307092624_remove_group_status'
AND "finished_at" IS NOT NULL
AND "rolled_back" = FALSE; 
