// Client-side authentication utilities
// For MVP, we rely on proxy to protect routes, but this utility can be used
// if we need to check auth status in client components

import { Session } from "next-auth";
import { API_AUTH_SESSION } from "../const/routes";

// Saves are Server Actions: `useAction` (src/lib/hooks/useAction.ts) owns the signed-out redirect.

/**
 * Check if the current user is authenticated by fetching the session
 * Returns true if authenticated, false otherwise
 * For MVP: proxy handles route protection, so this is mainly for optional checks
 */
export async function getAuthStatus(): Promise<boolean> {
	try {
		const res = await fetch(API_AUTH_SESSION);
		const data = await res.json();
		// Key on user.id, not mere user presence: an invalidated session can still carry a
		// user object shape, but only an id means a live login (matches hasSession()).
		return !!(data && data.user && data.user.id);
	} catch {
		return false;
	}
}

export const hasSession = (session: Session | null): boolean => {
	return !!session?.user?.id;
}

/**
 * A `/api/auth/session` read confirms a logout only when the request succeeded and the body has
 * no user id: `null` (no cookie), or `{ expires }` (token-version bump / user gone). A failed
 * read is not a logout — the cookie can still be valid, and treating it as one painted "Log in"
 * until a reload.
 */
export function sessionReadConfirmsLogout(ok: boolean, body: unknown): boolean {
	if (!ok) return false;
	if (!body || typeof body !== "object") return true;
	return !hasSession(body as Session);
}

export async function getUserId(session: Session | null): Promise<string | undefined> {
	return session?.user?.id;
}