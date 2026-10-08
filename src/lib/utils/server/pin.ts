// A page is its own profile: pins there do not count against the author's personal pins.
// Who may pin is the same check the pin button and the pin PATCH both use.

import { prisma } from "./prisma";
import { canPostAsPage } from "./permission";
import { inPinScope, type PinScope } from "@/lib/const/pin";

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

/**
 * May this viewer pin this post or event?
 * A page item can be pinned by an admin or editor of that page, including a member's post.
 * A personal item can be pinned only by its author.
 */
export async function canPinContent(
	viewerId: string | null,
	content: { userId: string; pageId: string | null },
): Promise<boolean> {
	if (!viewerId) return false;
	if (content.pageId) return canPostAsPage(viewerId, content.pageId);
	return content.userId === viewerId;
}

/**
 * Stamp `canPin` on collection rows for one profile.
 * An item on a different profile stays false, even when the viewer could pin it there.
 * Each page in scope is checked once, through `canPinContent`.
 */
export async function withCanPin<T extends { userId: string; pageId: string | null }>(
	items: T[],
	viewerId: string | null,
	scope: PinScope,
): Promise<(T & { canPin: boolean })[]> {
	const pageDecision = new Map<string, Promise<boolean>>();
	return Promise.all(items.map(async (item) => {
		if (!viewerId || !inPinScope(item, scope)) return { ...item, canPin: false };
		const pageId = item.pageId;
		if (!pageId) return { ...item, canPin: await canPinContent(viewerId, item) };
		let pending = pageDecision.get(pageId);
		if (!pending) {
			pending = canPinContent(viewerId, item);
			pageDecision.set(pageId, pending);
		}
		return { ...item, canPin: await pending };
	}));
}
