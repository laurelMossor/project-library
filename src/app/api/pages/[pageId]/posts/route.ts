import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { serverError } from "@/lib/utils/errors";
import { publicUserFields } from "@/lib/utils/server/user";

type RouteParams = { params: Promise<{ pageId: string }> };

/**
 * GET /api/pages/[pageId]/posts
 * List posts for a page
 * Public endpoint
 */
export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { pageId } = await params;

		const posts = await prisma.post.findMany({
			where: { pageId },
			include: {
				user: {
					select: publicUserFields,
				},
			},
			orderBy: { createdAt: "desc" },
		});

		return NextResponse.json(posts);
	} catch (error) {
		console.error("GET /api/pages/[pageId]/posts error:", error);
		return serverError("Failed to fetch posts");
	}
}
