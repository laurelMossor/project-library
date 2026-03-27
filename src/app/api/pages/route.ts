import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, serverError } from "@/lib/utils/errors";
import { createPage } from "@/lib/utils/server/page";
import { logAction } from "@/lib/utils/server/log";

/**
 * POST /api/pages
 * Create a new page
 * Protected endpoint (requires authentication)
 */
export async function POST(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const data = await request.json();
		const { name, slug, headline, bio, interests, location } = data;

		if (!name || !slug) {
			return badRequest("Name and slug are required");
		}

		const page = await createPage(ctx.userId, {
			name,
			slug,
			headline,
			bio,
			interests,
			location,
		});

		logAction("page.created", ctx.userId, { pageId: page.id });

		return NextResponse.json(page, { status: 201 });
	} catch (error) {
		if (error instanceof Error && error.message.includes("slug already exists")) {
			return badRequest(error.message);
		}
		console.error("POST /api/pages error:", error);
		return serverError("Failed to create page");
	}
}
