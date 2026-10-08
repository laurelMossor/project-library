/** One profile holds at most this many pinned posts and events, together. */
export const MAX_PINNED_PER_PROFILE = 3;

export const PIN_CAP_MESSAGE = `You can only pin up to ${MAX_PINNED_PER_PROFILE} items.`;

/** Whose pin slot an item spends. A page item belongs to that page; a personal item belongs to its author. */
export type PinScope = { pageId: string } | { userId: string };

type PinItem = { userId: string; pageId: string | null; pinnedAt?: Date | string | null };

/** True when this item spends the given profile's pin slot. Same split as `otherPinnedCount`. */
export function inPinScope(item: { userId: string; pageId: string | null }, scope: PinScope): boolean {
	if ("pageId" in scope) return item.pageId === scope.pageId;
	return item.pageId == null && item.userId === scope.userId;
}

/** How many items in this list are already pinned on this profile. */
export function pinnedCountInScope(items: PinItem[], scope: PinScope): number {
	return items.filter((item) => item.pinnedAt != null && inPinScope(item, scope)).length;
}
