"use server";

import { auth } from "@/auth";

/**
 * ユーザーが管理者かどうかを確認する関数
 * @returns ユーザーが管理者かどうか
 */
export async function isAdminUser(): Promise<boolean> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const session = await auth();
  if (!session?.user) return false;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ユーザーが管理者かどうかを判定するロジック
  // セッションからの管理者情報取得を仮で実装
  // @ts-ignore - isAppOwnerプロパティはカスタム拡張されている可能性があるためignore
  return !!session.user.isAppOwner;
}
