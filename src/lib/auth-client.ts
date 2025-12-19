// Client-side authentication utilities
// For MVP, we rely on middleware to protect routes, but this utility can be used
// if we need to check auth status in client components

/**
 * Check if the current user is authenticated by fetching the session
 * Returns true if authenticated, false otherwise
 * For MVP: middleware handles route protection, so this is mainly for optional checks
 */
export async function checkAuthClient(): Promise<boolean> {
	try {
		const res = await fetch("/api/auth/session");
		const data = await res.json();
		return !!(data && data.user);
	} catch {
		return false;
	}
}

