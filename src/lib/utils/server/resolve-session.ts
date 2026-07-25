// ⚠️ SERVER-ONLY: hits the database via Prisma.
//
// The NextAuth session-callback body, extracted from `src/lib/auth.ts` so it can be unit-tested
// without importing the NextAuth server module (which pulls in `next/server`), and so it lives
// in a plain module rather than being referenced from the module-level `NextAuth({...})` config.

import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { prisma } from "./prisma";

/**
 * Resolve the session returned to the client from the JWT. Confirms the token's epoch still
 * matches the user's current `tokenVersion` (bumped on password reset) on every authenticated
 * request. On a stale epoch or missing user it returns the session with `user` cleared entirely
 * — not just its id — so no consumer can read a lingering email/name and claim "logged in as X"
 * when there is no valid login. Downstream code gates on `session.user?.id`.
 */
export async function resolveSession(session: Session, token: JWT | null): Promise<Session> {
	try {
		if (token?.sub) {
			// One indexed lookup per authenticated request; callers then trust the session.
			const user = await prisma.user.findUnique({
				where: { id: token.sub },
				select: { tokenVersion: true },
			});
			if (!user || (token.tokenVersion ?? 0) !== user.tokenVersion) {
				return { ...session, user: undefined as unknown as typeof session.user };
			}
			session.user.id = token.sub;
			if (token.activePageId) {
				session.user.activePageId = token.activePageId as string;
			}
		}
		return session;
	} catch (error) {
		console.error("Session callback error:", error);
		return session;
	}
}
