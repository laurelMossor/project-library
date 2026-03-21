import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { serverError } from "@/lib/utils/errors";
import { eventWithUserFields } from "@/lib/utils/server/fields";

type RouteParams = { params: Promise<{ pageId: string }> };

/**
 * GET /api/pages/[pageId]/events
 * List events for a page
 * Public endpoint
 */
export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { pageId } = await params;

		const events = await prisma.event.findMany({
			where: { pageId },
			select: eventWithUserFields,
			orderBy: { eventDateTime: "asc" },
		});

		return NextResponse.json(events);
	} catch (error) {
		console.error("GET /api/pages/[pageId]/events error:", error);
		return serverError("Failed to fetch events");
	}
}
