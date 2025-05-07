"use server";

import type { CreateGroupFormData } from "@/components/group/create-group-form";
import type { SetupForm } from "@/components/setting/setup-form";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { createGroupSchema } from "@/lib/zod-schema";
import { z } from "zod";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー設定を更新または作成する関数
 * @param data - フォームから送信されたデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function updateUserSetup(data: SetupForm) {
  try {
    // 認証セッションを取得
    const userId = await getAuthenticatedSessionUserId();

    // フォームの回答内容をデータベースに保存する。更新or新規作成
    await prisma.userSettings.upsert({
      where: {
        userId: userId,
      },
      update: {
        username: data.username,
        lifeGoal: data.lifeGoal,
      },
      create: {
        userId: userId,
        username: data.username,
        lifeGoal: data.lifeGoal,
      },
    });

    // 保存が成功した場合
    return { success: true, redirect: "/dashboard/grouplist" };
  } catch (error) {
    // エラーログを出力
    console.error("Error updating user setup:", error);
    return { success: false, error: "設定の更新中にエラーが発生しました。" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループを作成する関数
 * @param data - グループ作成フォームのデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function createGroup(data: CreateGroupFormData) {
  console.log("createGroup", data);
  try {
    const userId = await getAuthenticatedSessionUserId();

    console.log("createGroup data", data);
    const validatedData = createGroupSchema.parse(data);
    console.log("createGroup validatedData", validatedData);

    await prisma.group.create({
      data: {
        ...validatedData,
        createdBy: userId,
      },
    });

    console.log("createGroup success");

    revalidatePath("/dashboard/grouplist");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Zod validation error:", error.errors);
      return { error: "入力内容に誤りがあります" };
    }
    console.error("createGroup unexpected error:", error);
    return { error: "エラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループに参加する関数
 * @param groupId - 参加するグループのID
 * @returns 処理結果を含むオブジェクト
 */
export async function joinGroup(groupId: string) {
  try {
    const userId = await getAuthenticatedSessionUserId();

    // グループの存在確認
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          where: {
            userId: userId,
          },
        },
      },
    });

    if (!group) {
      return { error: "グループが見つかりません" };
    }

    // 既に参加済みの場合
    if (group.members.length > 0) {
      return { error: "既に参加済みです" };
    }

    // 参加人数が上限に達している場合
    const memberCount = await prisma.groupMembership.count({
      where: { groupId },
    });
    if (memberCount >= group.maxParticipants) {
      return { error: "参加人数が上限に達しています" };
    }

    // グループに参加
    await prisma.groupMembership.create({
      data: {
        userId: userId,
        groupId,
      },
    });

    revalidatePath("/dashboard/grouplist");
    revalidatePath("/dashboard/my-groups");
    return { success: true };
  } catch (error) {
    console.error("[JOIN_GROUP]", error);
    return { error: "エラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループから脱退する関数
 * @param groupId - 脱退するグループのID
 * @returns 処理結果を含むオブジェクト
 */
export async function leaveGroup(groupId: string) {
  try {
    const userId = await getAuthenticatedSessionUserId();

    // メンバーシップの存在確認
    const membership = await prisma.groupMembership.findFirst({
      where: {
        userId: userId,
        groupId,
      },
    });

    if (!membership) {
      return { error: "グループに参加していません" };
    }

    // グループから脱退
    await prisma.groupMembership.delete({
      where: {
        id: membership.id,
      },
    });

    revalidatePath("/dashboard/grouplist");
    revalidatePath("/dashboard/my-groups");
    return { success: true };
  } catch (error) {
    console.error("[LEAVE_GROUP]", error);
    return { error: "エラーが発生しました" };
  }
}
