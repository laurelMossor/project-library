import { useMemo, useState } from "react";
import { CollectionItem } from "@/lib/types/collection";
import { filterCollectionItems, sortCollectionItemsByDate, filterCollectionItemsByTags } from "@/lib/utils/collection";

export type FilterType = "all" | "projects" | "events";
export type SortType = "newest" | "oldest" | "relevance";
export type ViewType = "grid" | "list" | "map";

export function useFilter(items: CollectionItem[]) {
	const [filter, setFilter] = useState<FilterType>("all");
	const [sort, setSort] = useState<SortType>("newest");
	const [view, setView] = useState<ViewType>("grid");
	const [selectedTags, setSelectedTags] = useState<string[]>([]);

	const filteredItems = useMemo(() => {
		let filtered = filterCollectionItems(items, filter);
		
		// Filter by tags if any are selected
		if (selectedTags.length > 0) {
			filtered = filterCollectionItemsByTags(filtered, selectedTags);
		}
		
		// Sort items (relevance is handled by API search, so no sorting needed)
		if (sort === "newest" || sort === "oldest") {
			return sortCollectionItemsByDate(filtered, sort);
		}
		
		return filtered;
	}, [items, filter, sort, selectedTags]);

	// Extract all unique tags from items
	const availableTags = useMemo(() => {
		const tagSet = new Set<string>();
		items.forEach((item) => {
			item.tags?.forEach((tag) => tagSet.add(tag));
		});
		return Array.from(tagSet).sort();
	}, [items]);

	return {
		filteredItems,
		filter,
		setFilter,
		sort,
		setSort,
		view,
		setView,
		selectedTags,
		setSelectedTags,
		availableTags,
	};
}

