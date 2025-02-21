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
 * このエラーは、Next.js がページコンポーネントに渡すプロパティの型定義の制約と、現状の型定義との間に不整合があるために発生しています。エラーメッセージでは、params がプレーンなオブジェクト ({ id: string }) になっているのに対し、Next.js の型定義では「Promise」として扱える（つまり then, catch などのメソッドを持つ）値であることを要求しているため、型が足りないと判断されています。
 * EditGroupPageProps の params をプレーンオブジェクトではなく、Promiseとして扱うように変更します。
 */
type EditGroupPageProps = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * グループを編集するページ
 * @param params - グループのID。URLのパラメーターから取得する。
 * @returns グループの詳細を編集するページ
 */
export default async function EditGroupPage({ params }: EditGroupPageProps) {
  // 型を Promise に変更した場合、コンポーネント内部で params を直接使用するのではなく、await して中身を取り出す必要があります。Promise を解決して、id を取り出す
  const { id } = await params;
  // グループの詳細を取得
  const group = await getGroup(id);

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
