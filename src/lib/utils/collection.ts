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

