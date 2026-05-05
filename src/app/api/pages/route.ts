import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, serverError } from "@/lib/utils/errors";
import { createPage } from "@/lib/utils/server/page";
import { validateHandle } from "@/lib/validations";
import { isReservedHandle } from "@/lib/const/reserved-handles";
import { isHandleTaken } from "@/lib/utils/server/handle";
import { logAction } from "@/lib/utils/server/log";

/**
 * POST /api/pages
 *
 * Creates a Page and its companion Handle row atomically (per PR 2's
 * cross-entity uniqueness model). The accepted JSON field is `handle`
 * (formerly `slug`); pre-PR2 client code that still sends `slug` would
 * not work — pre-beta breaking change, intentional.
 *
 * Validation order matches the signup route:
 *   1. Format     — `validateHandle` (lowercase + length + charset)
 *   2. Reserved   — `isReservedHandle` (would shadow a top-level route)
 *   3. Uniqueness — `isHandleTaken` (UX pre-check; DB constraint is the gate)
 *
 * Then `createPage` runs three writes inside a single $transaction:
 * Page (with nested Handle create) + creator-ADMIN Permission. A handle
 * race-condition between `isHandleTaken` and the write surfaces as
 * Prisma P2002, caught here and returned as a friendly error.
 *
 * Protected endpoint (requires authentication).
 */
export async function POST(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const data = await request.json();
		const { name, handle, headline, bio, interests, location } = data;

		if (!name || !handle) {
			return badRequest("Name and handle are required");
		}

		const normalizedHandle =
			typeof handle === "string" ? handle.toLowerCase().trim() : "";

		if (!validateHandle(normalizedHandle)) {
			return badRequest(
				"Handle must be 3–30 characters and contain only lowercase letters, numbers, underscores, and hyphens",
			);
		}

		if (isReservedHandle(normalizedHandle)) {
			return badRequest("That handle is reserved. Please choose another.");
		}

		if (await isHandleTaken(normalizedHandle)) {
			return badRequest("That handle is already taken");
		}

		try {
			const page = await createPage(ctx.userId, {
				name,
				handle: normalizedHandle,
				headline,
				bio,
				interests,
				location,
			});

			logAction("page.created", ctx.userId, { pageId: page.id });

			return NextResponse.json(page, { status: 201 });
		} catch (err) {
			if (
				typeof err === "object" &&
				err !== null &&
				"code" in err &&
				(err as { code?: string }).code === "P2002"
			) {
				return badRequest("That handle is already taken");
			}
			throw err;
		}
	} catch (error) {
		console.error("POST /api/pages error:", error);
		return serverError("Failed to create page");
	}
}
