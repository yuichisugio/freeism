import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * グループに参加するAPI
 * @param request - リクエスト
 * @param params - グループのID
 * @returns グループに参加するAPI
 */
export async function POST(request: Request, context: { params: { groupId: string } }) {
  const { params } = context;

  try {
    const session = await auth();

    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const groupId = params.groupId;

    // グループの存在確認
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          where: {
            userId: session.user.id,
          },
        },
      },
    });

    if (!group) {
      return new NextResponse("Group not found", { status: 404 });
    }

    // 既に参加済みの場合
    if (group.members.length > 0) {
      return new NextResponse("Already joined", { status: 400 });
    }

    // 参加人数が上限に達している場合
    const memberCount = await prisma.groupMembership.count({
      where: { groupId },
    });
    if (memberCount >= group.maxParticipants) {
      return new NextResponse("Group is full", { status: 400 });
    }

    // グループに参加
    const membership = await prisma.groupMembership.create({
      data: {
        userId: session.user.id,
        groupId,
      },
    });

    return NextResponse.json(membership);
  } catch (error) {
    console.error("[GROUP_JOIN]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
