import type { Metadata } from "next";
import { CreateGroupForm } from "@/components/group/create-group-form";
import { MainTemplate } from "@/components/layout/maintemplate";

/**
 * 新規Group作成ページのメタデータ
 * @returns 新規Group作成ページのメタデータ
 */
export const metadata: Metadata = {
  title: "新規Group作成 - Freeism App",
  description: "新しいグループを作成します",
};

/**
 * 新規Group作成ページ
 * @returns 新規Group作成ページ
 */
export default async function CreateGroupPage() {
  return (
    <MainTemplate title="新規Group作成" description="新しいグループを作成します">
      <CreateGroupForm />
    </MainTemplate>
  );
}
