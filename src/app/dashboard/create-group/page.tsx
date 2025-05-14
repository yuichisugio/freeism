"use cache";

import type { Metadata } from "next";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { CreateGroupForm } from "@/components/form/create-group-form";
import { MainTemplate } from "@/components/layout/maintemplate";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 新規Group作成ページのメタデータ
 * @returns 新規Group作成ページのメタデータ
 */
export const metadata: Metadata = {
  title: "新規Group作成 - Freeism App",
  description: "新しいグループを作成します",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 新規Group作成ページ
 * @returns 新規Group作成ページ
 */
export default async function CreateGroupPage() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュの有効期間を設定
   */
  cacheLife("max");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 新規Group作成ページを返す
   */
  return (
    <MainTemplate title="新規Group作成" description="新しいグループを作成します">
      <CreateGroupForm />
    </MainTemplate>
  );
}
