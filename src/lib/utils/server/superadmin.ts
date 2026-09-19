// ⚠️ SERVER-ONLY: Superadmin operator gate
//
// A *global* operator capability, distinct from the page-scoped PermissionRole tier
// in `permission.ts`. Superadmin gates cross-cutting ingestion surfaces (Poster
// Catcher's /admin/submissions) that aren't tied to any one page.
//
// v1 is env-driven (SUPERADMIN_USER_IDS, comma-separated user ids) — no schema
// column, trivially extended later. If a future version needs superadmin to be
// queryable data, this is the single seam to swap to a DB lookup.

import type { SessionContext } from "./session";

/** Parse SUPERADMIN_USER_IDS into a set of trimmed, non-empty user ids. */
function superAdminIds(): Set<string> {
	return new Set(
		(process.env.SUPERADMIN_USER_IDS ?? "")
			.split(",")
			.map((id) => id.trim())
			.filter(Boolean),
	);
}

/** Is this user id configured as a superadmin operator? */
export function isSuperAdmin(userId: string | null | undefined): boolean {
	if (!userId) return false;
	return superAdminIds().has(userId);
}

/**
 * Resolve the current session and require superadmin. Returns the session context on
 * success, or null when unauthenticated / not a superadmin. Callers map null → 403/404.
 * Use in every superadmin API route (defense-in-depth), not just the /admin layout.
 */
export async function requireSuperAdmin(): Promise<SessionContext | null> {
	// Dynamic import keeps this module's static graph free of the auth/next-auth chain,
	// so the pure `isSuperAdmin` gate stays trivially importable (and unit-testable).
	const { getSessionContext } = await import("./session");
	const ctx = await getSessionContext();
	if (!ctx || !isSuperAdmin(ctx.userId)) return null;
	return ctx;
}
