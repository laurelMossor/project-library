// One profile holds at most 3 pinned items. Posts and events share that cap.
// A page is its own profile: pins there do not count against the author's personal pins.

import { prisma } from "./prisma";

export const MAX_PINNED_PER_PROFILE = 3;

export const PIN_CAP_MESSAGE = `You can only pin up to ${MAX_PINNED_PER_PROFILE} items.`;

type PinScope = { pageId: string } | { userId: string };

/** How many other items are already pinned on this profile. Excludes the item being pinned. */
export async function otherPinnedCount(
	scope: PinScope,
	exclude: { postId?: string; eventId?: string },
): Promise<number> {
	const where = "pageId" in scope
		? { pageId: scope.pageId, pinnedAt: { not: null } }
		: { userId: scope.userId, pageId: null, pinnedAt: { not: null } };
	const [posts, events] = await Promise.all([
		prisma.post.count({
			where: exclude.postId ? { ...where, id: { not: exclude.postId } } : where,
		}),
		prisma.event.count({
			where: exclude.eventId ? { ...where, id: { not: exclude.eventId } } : where,
		}),
	]);
	return posts + events;
}
