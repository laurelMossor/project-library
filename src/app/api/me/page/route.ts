import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { getPageById, updatePageProfile, publicPageFields } from "@/lib/utils/server/page";
import { canPostAsPage } from "@/lib/utils/server/permission";
import { unauthorized, notFound, badRequest, serverError } from "@/lib/utils/errors";
import { validatePageUpdateData } from "@/lib/validations";
import { processElementsPayload } from "@/lib/utils/server/profile-element";
import { prisma } from "@/lib/utils/server/prisma";
import type { SavePayload } from "@/lib/types/inline-edit";

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
 * Update the active page profile. Accepts a structured SavePayload with scalar
 * fields and optional element operations, all in one transaction.
 * Protected endpoint.
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

		const allowed = await canPostAsPage(ctx.userId, ctx.activePageId);
		if (!allowed) {
			return NextResponse.json(
				{ error: "You don't have permission to manage this page" },
				{ status: 403 }
			);
		}

		const body = (await request.json()) as SavePayload;
		const { fields = {}, elements } = body;

		const {
			headline, bio, interests, location,
			addressLine1, addressLine2, city, state, zip,
			category, avatarImageId, isOpenToCollaborators,
		} = fields as {
			headline?: string;
			bio?: string;
			interests?: string[];
			location?: string;
			addressLine1?: string | null;
			addressLine2?: string | null;
			city?: string | null;
			state?: string | null;
			zip?: string | null;
			category?: string | null;
			avatarImageId?: string | null;
			isOpenToCollaborators?: boolean;
		};

		const validation = validatePageUpdateData({
			headline, bio, interests, location,
			addressLine1, addressLine2, city, state, zip,
			category, avatarImageId, isOpenToCollaborators,
		});

		if (!validation.valid) {
			return badRequest(validation.error || "Invalid page data");
		}

		const pageId = ctx.activePageId;
		const updatedPage = await prisma.$transaction(async () => {
			await updatePageProfile(pageId, {
				headline, bio, interests, location,
				addressLine1, addressLine2, city, state, zip,
				category, avatarImageId, isOpenToCollaborators,
			});

			if (elements) {
				await processElementsPayload({ pageId }, elements);
			}

			return prisma.page.findUnique({
				where: { id: pageId },
				select: publicPageFields,
			});
		});

		return NextResponse.json(updatedPage);
	} catch (error) {
		console.error("PUT /api/me/page error:", error);
		return serverError();
	}
}
