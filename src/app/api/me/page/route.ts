import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { getPageById } from "@/lib/utils/server/page";
import { canPostAsPage } from "@/lib/utils/server/permission";
import { unauthorized, notFound, badRequest, serverError } from "@/lib/utils/errors";
import { saveMyProfile } from "@/lib/utils/server/profile-update";
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

		// Re-verify the caller may act as this page — activePageId comes from the JWT, which
		// can be set client-side via updateSession without going through the validated route.
		const allowed = await canPostAsPage(ctx.userId, ctx.activePageId);
		if (!allowed) {
			return notFound("Active page not found");
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

		// Shared executor: whitelist + validate (incl. visibility) + cascade.
		// The old hand-rolled transaction here dropped `visibility` and skipped
		// the descendant-visibility cascade — using saveMyProfile fixes both.
		const result = await saveMyProfile("PAGE", ctx.activePageId, body);
		if (!result.ok) {
			return badRequest(result.error);
		}
		return NextResponse.json(result.profile);
	} catch (error) {
		console.error("PUT /api/me/page error:", error);
		return serverError();
	}
}
