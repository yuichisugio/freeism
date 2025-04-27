-- DropForeignKey
ALTER TABLE "UserSettings" DROP CONSTRAINT "UserSettings_user_id_fkey";

-- AlterTable
ALTER TABLE "UserSettings" ALTER COLUMN "username" SET DEFAULT '未設定',
ALTER COLUMN "life_goal" SET DEFAULT '未設定';

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
