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
 * Resolve a handle URL segment to its owning entity (User or Page).
 *
 * Single query against the `handles` table. The result includes the related
 * `user` and `page` records, exactly one of which will be non-null because
 * `userId` and `pageId` are mutually exclusive `@unique` FKs on the `Handle`
 * model — there's no tiebreaker policy because conflicts are structurally
 * impossible. Returns null if no handle matches (caller renders notFound()).
 *
 * This is the lookup that powers `[handle]/page.tsx` (and every gated
 * `[handle]/profile/...` route via `canManageEntity`).
 */
export async function findEntityByHandle(
	handle: string,
): Promise<(Handle & { user: User | null; page: Page | null }) | null> {
	return prisma.handle.findUnique({
		where: { handle: handle.toLowerCase() },
		include: { user: true, page: true },
	});
}
