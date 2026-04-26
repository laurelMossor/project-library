// Reserved handles — the set of slugs that may NOT be claimed as a User or
// Page handle. Two reasons something lands here:
//
//   1. There is a top-level route at `src/app/<segment>/` that would shadow
//      `/[handle]` if a real handle matched it. Anyone claiming `/explore`
//      would silently never resolve to the `[handle]` route because Next.js
//      file-system routing wins.
//   2. The string is brand-, security-, or convention-sensitive enough that
//      we don't want users typing it into a profile URL (`projectlibrary`,
//      `admin`, `mail`, `404`).
//
// CI safety net: `scripts/ci-check-reserved-handles.ts` (added in task 4)
// scans `src/app/` top-level dirs and fails CI if any are missing here.
// Keep this list in sync with that script — every new top-level route folder
// added to `src/app/` MUST be added here in the same PR.
export const RESERVED_HANDLES = new Set([
	// Existing top-level routes in src/app/
	"api",
	"explore",
	"events",
	"posts",
	"pages",
	"messages",
	"collections",
	"login",
	"signup",
	"settings",
	"profile",
	"logout",
	"welcome",
	"dev",
	"about",

	// Reserved single letters (a–z) for future subroutes.
	// Includes "u" and "p" — formerly the user/page route prefixes;
	// reserved here so no one can claim them post-flattening.
	"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
	"n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",

	// Auth / verification flows
	"auth",
	"oauth",
	"callback",
	"verify",
	"confirm",
	"reset",

	// Infrastructure / static paths
	"www",
	"mail",
	"smtp",
	"cdn",
	"static",
	"assets",
	"uploads",

	// Next.js internals
	"_next",

	// System / error pages
	"404",
	"500",
	"error",

	// Static files served at root
	"favicon.ico",
	"robots.txt",
	"sitemap.xml",
	"manifest.json",

	// Vanity / admin
	"admin",
	"support",
	"help",
	"terms",
	"privacy",
	"docs",
	"billing",
	"account",
	"me",
	"projects",

	// Anti-impersonation
	"projectlibrary",
	"theprojectlibrary",
	"library",
	"official",
	"staff",
	"team",

	// TODO(PR 3): if microsite admins can create custom subpaths under
	// /[handle]/X, add a separate RESERVED_SUBPATHS set covering "profile",
	// "connections", "about". For PR 2 this is unnecessary — file-system
	// routing wins automatically.
]);

/**
 * Case-insensitive reserved-handle check.
 *
 * Inputs are lowercased before comparison so callers don't have to
 * pre-normalize. Pair with `validateHandle` (format gate) and
 * `isHandleTaken` (uniqueness gate) at every handle-creation site.
 */
export function isReservedHandle(handle: string): boolean {
	return RESERVED_HANDLES.has(handle.toLowerCase());
}
