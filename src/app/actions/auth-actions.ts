"use server";

import type { Session } from "next-auth";
import { auth } from "@/auth";

/**
 * Auth.js v5のauth()関数をラップするサーバーアクション
 * 認証ライブラリの移行を容易にするため
 * layout.tsxなどSessionごと欲しい場合に使用する
 * @returns 認証セッション情報
 */
export async function getAuthSession(): Promise<Session | null> {
  return await auth();
}

/**
 * セッションのユーザーIDを取得するサーバーアクション
 * 認証ライブラリの移行を容易にするため
 * sessionのuserIdが欲しい時に使用する
 * @returns ユーザーID
 */
export async function getAuthenticatedSessionUserId(): Promise<string> {
  try {
    // セッション情報を取得
    const session = await auth();

    // セッション情報が取得できない場合はエラーを投げる
    if (!session?.user?.id) {
      throw new Error("auth-actions.ts_getSessionUserId_ユーザーIDが取得できませんでした");
    }

    const sessionUserId = session.user.id;

    // セッション情報が取得できた場合はユーザーIDを返す
    return sessionUserId;

    // エラーが発生した場合はエラーを投げる
  } catch (error) {
    console.error(error);
    throw new Error("auth-actions.ts_getSessionUserId_ユーザーIDが取得できませんでした");
  }
}
