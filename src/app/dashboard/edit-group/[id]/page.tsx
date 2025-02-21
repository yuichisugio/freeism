import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGroup } from "@/app/actions";
import { EditGroupForm } from "@/components/group/edit-group-form";
import { MainTemplate } from "@/components/layout/maintemplate";

/**
 * グループを編集するページのメタデータ
 * @returns グループを編集するページのメタデータ
 */
export const metadata: Metadata = {
  title: "グループを編集 - Freeism App",
  description: "グループの詳細を編集します",
};

/**
 * グループを編集するページのパラメーター
 * @returns グループを編集するページのパラメーター
 */
type EditGroupPageProps = {
  params: {
    id: string;
  };
};

/**
 * グループを編集するページ
 * @param params - グループのID。URLのパラメーターから取得する。
 * @returns グループの詳細を編集するページ
 */
export default async function EditGroupPage({ params }: EditGroupPageProps) {
  // グループの詳細を取得
  const group = await getGroup(params.id);

  // グループが見つからない場合は404エラーを返す
  if (!group) {
    notFound();
  }

  // グループの詳細を編集するフォームを表示
  return (
    <MainTemplate title="グループを編集" description="グループの詳細を編集します">
      <EditGroupForm group={group} />
    </MainTemplate>
  );
}
