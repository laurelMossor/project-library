import { CollectionItem, isEvent, isProject, getCollectionItemType, getCollectionItemDate } from "../types/collection";

export const itemHasCollectionType = (item: CollectionItem) => isProject(item) || isEvent(item);

/**
 * Get the detail page URL for a collection item
 */
export function getCollectionItemUrl(item: CollectionItem): string {
	return isEvent(item) ? `/events/${item.id}` : `/projects/${item.id}`;
}

/**
 * Generate a stable React key for a collection item
 */
export function getCollectionItemKey(item: CollectionItem): string {
	return `${getCollectionItemType(item)}-${item.id}`;
}

/**
 * Sort collection items by date
 */
export function sortCollectionItemsByDate(
	items: CollectionItem[],
	direction: "newest" | "oldest"
): CollectionItem[] {
	const sorted = [...items];
	const multiplier = direction === "newest" ? -1 : 1;
	
	sorted.sort((a, b) => {
		const dateA = getCollectionItemDate(a);
		const dateB = getCollectionItemDate(b);
		return (dateA.getTime() - dateB.getTime()) * multiplier;
	});
	
	return sorted;
}

/**
 * Filter collection items by type
 */
export function filterCollectionItems(
	items: CollectionItem[],
	filter: "all" | "projects" | "events"
): CollectionItem[] {
	if (filter === "all") {
		return items;
	}
	
	return items.filter((item) => {
		if (filter === "projects") {
			return !isEvent(item);
		}
		return isEvent(item);
	});
}

