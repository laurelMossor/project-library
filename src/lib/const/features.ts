// Feature flags — compile-time constants, flipped in code (not env vars, not a
// flag service). They gate finished-but-not-yet-enabled surfaces for beta.
//
// Pure constants: no `server-only` guard, no env access, no Prisma import, so both
// server routes and client components import the same value. Flip a value here (a
// one-line PR) to turn a surface on everywhere.

export const FEATURES = {
	/**
	 * Self-service page membership: the "Join" button, the request-to-JOIN path, and
	 * MEMBER as an admin-assignable role. OFF for beta — following a page already
	 * grants the same access membership does, so Follow (+ request-to-follow) is the
	 * single relationship until a members-only feature exists. Flip to `true` to
	 * restore the full membership surface; nothing else needs to change.
	 */
	SELF_SERVICE_MEMBERSHIP: false,
} as const;

export type FeatureFlag = keyof typeof FEATURES;
