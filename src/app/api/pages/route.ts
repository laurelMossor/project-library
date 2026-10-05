import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, serverError } from "@/lib/utils/errors";
import { createPage } from "@/lib/utils/server/page";
import { validateHandle, validateMembershipFields } from "@/lib/validations";
import { ContentVisibility, MembershipPolicy, ProfileVisibility } from "@prisma/client";
import { pickProfileFields, validateProfileFields } from "@/lib/utils/server/profile-update";
import { isReservedHandle } from "@/lib/const/reserved-handles";
import { generateUniqueHandle, isHandleTaken } from "@/lib/utils/server/handle";
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
		const { name, handle, headline, bio, interests, location, membershipPolicy, allowMemberPosts } = data;

		if (!name || typeof name !== "string" || !name.trim()) {
			return badRequest("Name is required");
		}

		const suppliedHandle = typeof handle === "string" && handle.trim()
			? handle.toLowerCase().trim()
			: null;

		// The rest of the profile (visibility, address, photo) goes through the same whitelist and
		// validation as editing an existing page, so creating can't accept what editing would refuse.
		const picked = pickProfileFields("PAGE", data);
		const fieldError = validateProfileFields("PAGE", picked);
		if (fieldError) return badRequest(fieldError);
		const profileVisibility = picked.profileVisibility as ProfileVisibility | undefined;
		const contentVisibility = picked.contentVisibility as ContentVisibility | undefined;
		if (profileVisibility === "PRIVATE" && (contentVisibility ?? "LISTED") === "LISTED") {
			return badRequest("A private profile can't have listed content — choose Unlisted or Private for your posts.");
		}

		const membership = validateMembershipFields({ membershipPolicy, allowMemberPosts });
		if (!membership.valid) return badRequest(membership.error || "Invalid membership settings");

		// A caller-chosen handle fails loudly. An omitted one is regenerated on a race (P2002).
		const attempts = suppliedHandle ? 1 : 3;
		let lastTaken = false;
		for (let attempt = 0; attempt < attempts; attempt++) {
			const normalizedHandle = suppliedHandle ?? await generateUniqueHandle(name.trim());

			if (!validateHandle(normalizedHandle)) {
				return badRequest(
					"Handle must be 3–30 characters and contain only lowercase letters, numbers, periods, underscores, and hyphens",
				);
			}
			if (isReservedHandle(normalizedHandle)) {
				return badRequest("That handle is reserved. Please choose another.");
			}
			if (suppliedHandle && await isHandleTaken(normalizedHandle)) {
				return badRequest("That handle is already taken");
			}

			try {
				const page = await createPage(ctx.userId, {
					name: name.trim(),
					handle: normalizedHandle,
					headline,
					bio,
					interests,
					location,
					membershipPolicy: membershipPolicy as MembershipPolicy | undefined,
					allowMemberPosts,
					profileVisibility,
					contentVisibility,
					addressLine1: picked.addressLine1 as string | null | undefined,
					addressLine2: picked.addressLine2 as string | null | undefined,
					city: picked.city as string | null | undefined,
					state: picked.state as string | null | undefined,
					zip: picked.zip as string | null | undefined,
					avatarImageId: picked.avatarImageId as string | null | undefined,
				});

				logAction("page.created", ctx.userId, { pageId: page.id });
				return NextResponse.json(page, { status: 201 });
			} catch (err) {
				const taken = typeof err === "object" && err !== null && "code" in err
					&& (err as { code?: string }).code === "P2002";
				if (!taken) throw err;
				lastTaken = true;
			}
		}
		if (lastTaken) return badRequest("That handle is already taken");
		return serverError("Failed to create page");
	} catch (error) {
		console.error("POST /api/pages error:", error);
		return serverError("Failed to create page");
	}
}
