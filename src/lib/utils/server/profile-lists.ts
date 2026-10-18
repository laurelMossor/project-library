// ⚠️ SERVER-ONLY: the people behind a profile's Followers / Following / Members counts.
//
// The counts ride on the profile render; the lists load when someone opens them, through this util,
// so the visibility rule is enforced here on the server (see VISIBILITY_RULES.md 5b).

import { ResourceType } from "@prisma/client";
import { prisma } from "./prisma";
import type { EntityRef } from "./activity";
import type { CardEntity } from "@/lib/types/card";
import type { ProfileList } from "@/lib/types/profile";
import { DomainError } from "./domain-error";
import { getPageFollowers, getPageFollowing, getUserFollowers, getUserFollowing } from "./follow";
import { getResourcePermissions } from "./permission";
import { canViewFollowList, canViewMemberList, resolveProfileAccess, type ViewerContext } from "./visibility";

/**
 * The profiles in one of a profile's lists, if this viewer may open it:
 *   followers / following → anyone who sees the FULL profile
 *   members               → members of that page only
 * A refusal is a DomainError ("forbidden" / "not_found"); the list is never partially filled.
 */
export async function listProfileConnections(
	viewer: ViewerContext,
	target: EntityRef,
	list: ProfileList,
): Promise<CardEntity[]> {
	const select = { id: true, profileVisibility: true } as const;
	const entity =
		target.type === "USER"
			? await prisma.user.findUnique({ where: { id: target.id }, select })
			: await prisma.page.findUnique({ where: { id: target.id }, select });
	if (!entity) throw new DomainError("Profile not found", "not_found");

	if (list === "members") {
		if (target.type !== "PAGE") throw new DomainError("Only pages have members");
		if (!canViewMemberList(viewer, target.id)) {
			throw new DomainError("Only members can see who's in this page", "forbidden");
		}
		const permissions = await getResourcePermissions(target.id, ResourceType.PAGE);
		return permissions.map((p) => p.user);
	}

	const access = await resolveProfileAccess(target.type, entity, viewer);
	if (!canViewFollowList(access)) {
		throw new DomainError("This profile is private", "forbidden");
	}

	const isUser = target.type === "USER";
	const items = await (list === "followers"
		? isUser ? getUserFollowers(target.id) : getPageFollowers(target.id)
		: isUser ? getUserFollowing(target.id) : getPageFollowing(target.id));
	return items.flatMap((item) => {
		const profile = item.user ?? item.page;
		return profile ? [profile] : [];
	});
}
