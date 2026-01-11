// ⚠️ SERVER-ONLY: Actor session utility functions
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { Session } from "next-auth";
import { getUserById } from "./user";
import { getOrgById, getUserOrgRole } from "./org";
import { Actor } from "@/lib/types/actor";
import { PublicUser } from "@/lib/types/user";
import { PublicOrg } from "@/lib/types/org";

/**
 * Check if a user can act as a specific org
 * Returns the user's role in the org, or null if not a member
 */
export async function canActAsOrg(userId: string, orgId: string): Promise<boolean> {
	const role = await getUserOrgRole(userId, orgId);
	// User can act as org if they have OWNER, ADMIN, or MEMBER role (not FOLLOWER)
	return role !== null && role !== "FOLLOWER";
}

/**
 * Get the active actor from session
 * Returns the org if activeOrgId is set and user has permission, otherwise returns the user
 */
export async function getActiveActor(session: Session | null): Promise<Actor | null> {
	if (!session?.user?.id) {
		return null;
	}

	const userId = session.user.id;
	const activeOrgId = session.user.activeOrgId;

	// If no activeOrgId, return user actor
	if (!activeOrgId) {
		const user = await getUserById(userId);
		if (!user) return null;
		return { type: "USER", data: user };
	}

	// Verify user has permission to act as this org
	const hasPermission = await canActAsOrg(userId, activeOrgId);
	if (!hasPermission) {
		// User lost permission, return user actor instead
		const user = await getUserById(userId);
		if (!user) return null;
		return { type: "USER", data: user };
	}

	// Get org and return org actor
	const org = await getOrgById(activeOrgId);
	if (!org) {
		// Org doesn't exist, return user actor
		const user = await getUserById(userId);
		if (!user) return null;
		return { type: "USER", data: user };
	}

	return { type: "ORG", data: org };
}

/**
 * Get the current user from session (always returns user, never org)
 */
export async function getSessionUser(session: Session | null): Promise<PublicUser | null> {
	if (!session?.user?.id) {
		return null;
	}
	return await getUserById(session.user.id);
}
