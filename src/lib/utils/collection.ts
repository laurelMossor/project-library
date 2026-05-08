import { CollectionItem, isEvent, isPost, getCollectionItemType, getCollectionItemDate, getCollectionItemCreatedAt, isPastEvent } from "../types/collection";

import { FilterCollectionType } from "../types/collection";

export const itemHasCollectionType = (item: CollectionItem) => isEvent(item) || isPost(item);

/**
 * Get the detail page URL for a collection item
 */
export function getCollectionItemUrl(item: CollectionItem): string {
	if (isPost(item)) {
		return `/posts/${item.id}`;
	}
	return `/events/${item.id}`;
}

/**
 * Generate a stable React key for a collection item
 */
export function getCollectionItemKey(item: CollectionItem): string {
	return `${getCollectionItemType(item)}-${item.id}`;
}

/**
 * Sort collection items by date.
 * - "all" / "post" tabs: sort by createdAt so events intermix with posts by post date.
 * - "event" tab: upcoming events first (soonest → furthest), then past events (most recent → oldest).
 */
export function sortCollectionItemsByDate(
	items: CollectionItem[],
	direction: "newest" | "oldest",
	filterType: FilterCollectionType = "all"
): CollectionItem[] {
	if (filterType === "event") {
		return sortEventsForExploration(items);
	}

	const sorted = [...items];
	const multiplier = direction === "newest" ? -1 : 1;

	sorted.sort((a, b) => {
		const dateA = getCollectionItemCreatedAt(a);
		const dateB = getCollectionItemCreatedAt(b);
		return (dateA.getTime() - dateB.getTime()) * multiplier;
	});

	return sorted;
}

function sortEventsForExploration(items: CollectionItem[]): CollectionItem[] {
	const upcoming: CollectionItem[] = [];
	const past: CollectionItem[] = [];

	for (const item of items) {
		if (isPastEvent(item)) {
			past.push(item);
		} else {
			upcoming.push(item);
		}
	}

	upcoming.sort((a, b) =>
		getCollectionItemDate(a).getTime() - getCollectionItemDate(b).getTime()
	);
	past.sort((a, b) =>
		getCollectionItemDate(b).getTime() - getCollectionItemDate(a).getTime()
	);

	return [...upcoming, ...past];
}

/**
 * Filter collection items by tags
 * Returns items that have at least one tag matching any of the selected tags (case-insensitive, partial match)
 */
export function filterCollectionItemsByTags(
	items: CollectionItem[],
	selectedTags: string[]
): CollectionItem[] {
	if (selectedTags.length === 0) {
		return items;
	}
	
	return items.filter((item) => {
		const itemTags = item.tags || [];
		// Return true if any item tag contains any of the selected tags (case-insensitive, partial match)
		return selectedTags.some((selectedTag) => {
			const selectedTagLower = selectedTag.toLowerCase();
			return itemTags.some((itemTag) => 
				itemTag.toLowerCase().includes(selectedTagLower)
			);
		});
	});
}

/**
 * Filter collection items by type
 */
export function filterCollectionItems(
	items: CollectionItem[],
	collectionTypeFilter: FilterCollectionType
): CollectionItem[] {
	if (collectionTypeFilter === "all") {
		return items;
	}
	
	return items.filter((item) => item.type === collectionTypeFilter);
}

