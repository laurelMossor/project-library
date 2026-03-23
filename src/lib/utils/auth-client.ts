// Client-side authentication utilities
// For MVP, we rely on proxy to protect routes, but this utility can be used
// if we need to check auth status in client components

import { Session } from "next-auth";
import { API_AUTH_SESSION } from "../const/routes";

/**
 * Error thrown when an API request fails due to an expired or invalid session.
 * Components can catch this to redirect to login instead of showing a generic error.
 */
export class AuthError extends Error {
	constructor(message = "Your session has expired. Please log in again.") {
		super(message);
		this.name = "AuthError";
	}
}

/**
 * Wrapper around fetch that throws AuthError on 401 responses.
 * Use this for authenticated API calls in client code to get consistent
 * stale-session handling across the app.
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	const res = await fetch(input, init);

	if (res.status === 401) {
		throw new AuthError();
	}

	return res;
}

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