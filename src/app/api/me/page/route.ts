import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { getPageById, updatePageProfile } from "@/lib/utils/server/page";
import { canPostAsPage } from "@/lib/utils/server/permission";
import { unauthorized, notFound, badRequest, serverError } from "@/lib/utils/errors";
import { validatePageUpdateData } from "@/lib/validations";

/**
 * GET /api/me/page
 * Get the active page profile (if activePageId set in session)
 * Protected endpoint
 */
export async function GET() {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		if (!ctx.activePageId) {
			return notFound("No active page set. Currently acting as personal identity.");
		}

		const page = await getPageById(ctx.activePageId);
		if (!page) {
			return notFound("Active page not found");
		}

		return NextResponse.json(page);
	} catch (error) {
		console.error("GET /api/me/page error:", error);
		return serverError();
	}
}

/**
 * PUT /api/me/page
 * Update the active page profile
 * Protected endpoint
 */
export async function PUT(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		if (!ctx.activePageId) {
			return badRequest("No active page set. Cannot update page profile.");
		}

		// Verify user has permission to manage this page
		const allowed = await canPostAsPage(ctx.userId, ctx.activePageId);
		if (!allowed) {
			return NextResponse.json(
				{ error: "You don't have permission to manage this page" },
				{ status: 403 }
			);
		}

		const body = await request.json();
		const {
			headline,
			bio,
			interests,
			location,
			addressLine1,
			addressLine2,
			city,
			state,
			zip,
			parentTopic,
			avatarImageId,
			isOpenToCollaborators,
		} = body;

		// Validate update data
		const validation = validatePageUpdateData({
			headline,
			bio,
			interests,
			location,
			addressLine1,
			addressLine2,
			city,
			state,
			zip,
			parentTopic,
			avatarImageId,
			isOpenToCollaborators,
		});

		if (!validation.valid) {
			return badRequest(validation.error || "Invalid page data");
		}

		const updatedPage = await updatePageProfile(ctx.activePageId, {
			headline,
			bio,
			interests,
			location,
			addressLine1,
			addressLine2,
			city,
			state,
			zip,
			parentTopic,
			avatarImageId,
			isOpenToCollaborators,
		});

		return NextResponse.json(updatedPage);
	} catch (error) {
		console.error("PUT /api/me/page error:", error);
		return serverError();
	}
}
