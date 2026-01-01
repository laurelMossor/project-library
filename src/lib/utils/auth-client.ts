// Client-side authentication utilities
// For MVP, we rely on proxy to protect routes, but this utility can be used
// if we need to check auth status in client components

import { Session } from "next-auth";
import { API_AUTH_SESSION } from "../const/routes";

/**
 * Check if the current user is authenticated by fetching the session
 * Returns true if authenticated, false otherwise
 * For MVP: proxy handles route protection, so this is mainly for optional checks
 */
export async function getAuthStatus(): Promise<boolean> {
	try {
		const res = await fetch(API_AUTH_SESSION);
		const data = await res.json();
		return !!(data && data.user);
	} catch {
		return false;
	}
}

export const hasSession = (session: Session | null): boolean => {
	return !!session?.user?.id;
}

export async function getUserId(session: Session | null): Promise<string | undefined> {
	return session?.user?.id;
}