import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type GroupRouteContext = {
  params: { id: string };
};

export async function GET(req: Request, { params }: GroupRouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return new NextResponse("Group ID is required", { status: 400 });
    }

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: true,
        tasks: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return new NextResponse("Group not found", { status: 404 });
    }

    return NextResponse.json(group);
  } catch (error) {
    console.error("[GROUP_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
