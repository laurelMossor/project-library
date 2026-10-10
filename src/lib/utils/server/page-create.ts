// ⚠️ SERVER-ONLY: validation + creation of a new Page from client input.
//
// Creates a Page and its companion Handle row atomically (cross-entity uniqueness model).
// Validation order matches the signup flow:
//   1. Format     — `validateHandle` (lowercase + length + charset)
//   2. Reserved   — `isReservedHandle` (would shadow a top-level route)
//   3. Uniqueness — `isHandleTaken` (UX pre-check; DB constraint is the gate)
// Then `createPage` runs Page (with nested Handle create) + creator-ADMIN Permission in one
// transaction. A handle race between `isHandleTaken` and the write surfaces as Prisma P2002,
// which is turned into a friendly refusal here.

import type { ContentVisibility, MembershipPolicy, ProfileVisibility } from "@prisma/client";
import type { PageCreateInput } from "@/lib/types/page";
import { isCuid, validateHandle, validateMembershipFields } from "@/lib/validations";
import { isReservedHandle } from "@/lib/const/reserved-handles";
import { DomainError } from "./domain-error";
import { createPage } from "./page";
import { generateUniqueHandle, isHandleTaken } from "./handle";
import { pickProfileFields, profileContentPairingError, validateProfileFields } from "./profile-update";
import { logAction } from "./log";

/** Prisma P2002 `meta.target`, or null when this error is not a unique violation. */
function uniqueTarget(err: unknown): string[] | null {
	if (typeof err !== "object" || err === null || !("code" in err)) return null;
	if ((err as { code?: string }).code !== "P2002") return null;
	const target = (err as { meta?: { target?: unknown } }).meta?.target;
	if (Array.isArray(target)) return target.map(String);
	if (typeof target === "string") return [target];
	return [];
}

/** Validate client-supplied page fields and create the page. Refusals are DomainErrors. */
export async function createPageFromInput(userId: string, data: PageCreateInput): Promise<{ id: string; handle: string }> {
	if (!data || typeof data !== "object") throw new DomainError("Invalid page");
	const { name, handle, headline, bio, interests, location, membershipPolicy, allowMemberPosts } = data as Record<string, any>;

	let id: string | undefined;
	if (data.id !== undefined && data.id !== null) {
		if (typeof data.id !== "string" || !isCuid(data.id)) throw new DomainError("Invalid page id");
		id = data.id;
	}

	if (!name || typeof name !== "string" || !name.trim()) throw new DomainError("Name is required");

	const suppliedHandle = typeof handle === "string" && handle.trim() ? handle.toLowerCase().trim() : null;

	// The rest of the profile (visibility, address, photo) goes through the same whitelist and
	// validation as editing an existing page, so creating can't accept what editing would refuse.
	const picked = pickProfileFields("PAGE", data);
	const fieldError = validateProfileFields("PAGE", picked);
	if (fieldError) throw new DomainError(fieldError);
	const profileVisibility = picked.profileVisibility as ProfileVisibility | undefined;
	const contentVisibility = picked.contentVisibility as ContentVisibility | undefined;
	// Omitted content visibility is the LISTED default createPage would store.
	const pairingError = profileContentPairingError(profileVisibility, contentVisibility ?? "LISTED");
	if (pairingError) throw new DomainError(pairingError);

	const membership = validateMembershipFields({ membershipPolicy, allowMemberPosts });
	if (!membership.valid) throw new DomainError(membership.error || "Invalid membership settings");

	// A caller-chosen handle fails loudly. An omitted one is regenerated on a race (P2002).
	const attempts = suppliedHandle ? 1 : 3;
	let lastTaken = false;
	for (let attempt = 0; attempt < attempts; attempt++) {
		const normalizedHandle = suppliedHandle ?? (await generateUniqueHandle(name.trim()));

		if (!validateHandle(normalizedHandle)) {
			throw new DomainError(
				"Handle must be 3–30 characters and contain only lowercase letters, numbers, periods, underscores, and hyphens",
			);
		}
		if (isReservedHandle(normalizedHandle)) throw new DomainError("That handle is reserved. Please choose another.");
		if (suppliedHandle && (await isHandleTaken(normalizedHandle))) {
			throw new DomainError("That handle is already taken", "conflict");
		}

		try {
			const page = await createPage(userId, {
				id,
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

			logAction("page.created", userId, { pageId: page.id });
			return { id: page.id, handle: page.handle };
		} catch (err) {
			// AvatarNotAllowed is already a DomainError and passes through.
			const target = uniqueTarget(err);
			if (!target) throw err;
			if (target.some((field) => field === "id" || field.endsWith("_pkey"))) {
				throw new DomainError("Couldn't create the page. Try again.");
			}
			lastTaken = true;
		}
	}
	if (lastTaken) throw new DomainError("That handle is already taken", "conflict");
	throw new Error("Failed to create page");
}
