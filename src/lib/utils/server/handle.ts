// ⚠️ SERVER-ONLY: hits the database via Prisma.
//
// Handle lookups go through the `handles` table — the cross-entity
// uniqueness layer added in PR 2. Both User.handle and Page.handle still
// have entity-scoped @unique constraints; the `handles` table is what
// guarantees a User and a Page can't share a handle, and it's the routing
// lookup target for `/[handle]/...`.
//
// Pairs with `validateHandle` (format), `isReservedHandle` (reservation),
// and `isHandleTaken` (uniqueness) at every handle-creation site.
import type { Handle, Page, User } from "@prisma/client";
import { prisma } from "./prisma";
import { validateHandle } from "@/lib/validations";
import { isReservedHandle } from "@/lib/const/reserved-handles";

/**
 * UX pre-check: does this handle already belong to a User or Page?
 *
 * Returns true if any row in the `handles` table matches (case-insensitive
 * — input is lowercased to match the always-lowercase storage convention).
 * Use before issuing INSERT to surface a friendly "handle already taken"
 * error. The real guarantee is the DB-level `handle @unique` constraint;
 * this function is a UX convenience, not the gate. Callers must still
 * handle the unique-constraint violation that bubbles up if a concurrent
 * registration wins the race between the check and the insert.
 */
export async function isHandleTaken(handle: string): Promise<boolean> {
	const existing = await prisma.handle.findUnique({
		where: { handle: handle.toLowerCase() },
	});
	return existing !== null;
}

/**
 * Generate a unique, valid handle from a seed (typically the email local-part), for the signup
 * flow that no longer asks users to pick one. The result always passes `validateHandle`, isn't
 * reserved, and is free in the `handles` namespace at check time.
 *
 * The first candidate is the bare, sanitized base; subsequent candidates append a short random
 * suffix. A too-short / empty base (e.g. an all-symbol local-part) falls back to a neutral base.
 *
 * TOCTOU: like every handle-creation site this is a pre-check, not a guarantee — a concurrent
 * signup can still claim the handle between here and the insert (P2002). On the auto-generated
 * path the caller must resolve that by regenerating, never by surfacing an error, since the user
 * never chose the value.
 */
export async function generateUniqueHandle(seed: string): Promise<string> {
	// Local-part, lowercased, stripped to the valid charset; trimmed to leave room for a suffix.
	const local = (seed.split("@")[0] ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
	let base = local.slice(0, 24);
	// validateHandle requires ≥3 chars — pad a too-short/empty base with a neutral prefix.
	if (base.length < 3) base = `member${base}`.slice(0, 24);

	const candidates: string[] = [base];
	for (let i = 0; i < 12; i++) {
		const suffix = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digits
		candidates.push(`${base}-${suffix}`.slice(0, 30));
	}

	for (const candidate of candidates) {
		if (!validateHandle(candidate)) continue;
		if (isReservedHandle(candidate)) continue;
		if (await isHandleTaken(candidate)) continue;
		return candidate;
	}

	// Astronomically-unlikely fallback: a fully random handle unrelated to the seed.
	for (let i = 0; i < 20; i++) {
		const rnd = `user-${Math.random().toString(36).slice(2, 10)}`;
		if (validateHandle(rnd) && !isReservedHandle(rnd) && !(await isHandleTaken(rnd))) {
			return rnd;
		}
	}
	throw new Error("Could not generate a unique handle");
}

export type SetHandleResult = { ok: true; handle: string } | { ok: false; error: string };

/**
 * Change a user's handle, keeping `User.handle` and the companion `Handle` namespace row in
 * step atomically. Runs the same format/reserved/uniqueness checks as signup. A change to the
 * user's current handle is a no-op success; the `Handle` row is upserted so a legacy user
 * missing one is repaired rather than 500ing. The DB `handle @unique` constraint is the real
 * guarantee — a lost race surfaces as a friendly "already taken", not a Prisma error.
 */
export async function setUserHandle(userId: string, rawHandle: string): Promise<SetHandleResult> {
	const handle = rawHandle.toLowerCase().trim();

	if (!validateHandle(handle)) {
		return {
			ok: false,
			error: "Handle must be 3–30 characters: lowercase letters, numbers, underscores, or hyphens.",
		};
	}
	if (isReservedHandle(handle)) {
		return { ok: false, error: "That handle is reserved. Please choose another." };
	}

	const current = await prisma.user.findUnique({ where: { id: userId }, select: { handle: true } });
	if (!current) return { ok: false, error: "User not found" };
	// No-op: changing to your own current handle (its `handles` row is "taken" by you).
	if (current.handle === handle) return { ok: true, handle };

	if (await isHandleTaken(handle)) {
		return { ok: false, error: "That handle is already taken." };
	}

	try {
		await prisma.$transaction([
			prisma.user.update({ where: { id: userId }, data: { handle } }),
			prisma.handle.upsert({
				where: { userId },
				update: { handle },
				create: { handle, userId },
			}),
		]);
	} catch (err) {
		if (
			typeof err === "object" && err !== null && "code" in err &&
			(err as { code?: string }).code === "P2002"
		) {
			return { ok: false, error: "That handle is already taken." };
		}
		throw err;
	}
	return { ok: true, handle };
}

/**
 * Resolve a handle URL segment to its owning entity (User or Page).
 *
 * Single query against the `handles` table. The result includes the related
 * `user` and `page` records, exactly one of which will be non-null because
 * `userId` and `pageId` are mutually exclusive `@unique` FKs on the `Handle`
 * model — there's no tiebreaker policy because conflicts are structurally
 * impossible. Returns null if no handle matches (caller renders notFound()).
 *
 * This is the lookup that powers `[handle]/page.tsx` (the public profile
 * dispatcher). Previously also used by the now-deleted `[handle]/profile/...`
 * routes; manage routes are now session-scoped at `/profile`, `/connections`.
 */
export async function findEntityByHandle(
	handle: string,
): Promise<(Handle & { user: User | null; page: Page | null }) | null> {
	return prisma.handle.findUnique({
		where: { handle: handle.toLowerCase() },
		include: { user: true, page: true },
	});
}
