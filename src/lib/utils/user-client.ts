import { PublicUser } from "../types/user";
import { API_PROFILE } from "../const/routes";

// CLIENT-SIDE FETCH UTILITIES
// These functions fetch from the API routes and can be used in client components
// This file is separate to avoid importing server-only Prisma code in client components

/**
 * Fetch current user's profile
 * Client-side utility that calls the /api/profile endpoint
 * Returns null if user is not authenticated
 */
export async function fetchProfile(): Promise<PublicUser | null> {
	const res = await fetch(API_PROFILE);

	if (!res.ok) {
		if (res.status === 401 || res.status === 404) {
			return null;
		}
		throw new Error("Failed to fetch profile");
	}

	return res.json();
}

