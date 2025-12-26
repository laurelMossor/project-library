import { useMemo, useState } from "react";
import { CollectionItem } from "@/lib/types/collection";
import { filterCollectionItems, sortCollectionItemsByDate } from "@/lib/utils/collection";

export type FilterType = "all" | "projects" | "events";
export type SortType = "newest" | "oldest" | "relevance";
export type ViewType = "grid" | "list" | "map";

export function useFilter(items: CollectionItem[]) {
	const [filter, setFilter] = useState<FilterType>("all");
	const [sort, setSort] = useState<SortType>("newest");
	const [view, setView] = useState<ViewType>("grid");

	const filteredItems = useMemo(() => {
		const filtered = filterCollectionItems(items, filter);
		
		// Sort items (relevance is handled by API search, so no sorting needed)
		if (sort === "newest" || sort === "oldest") {
			return sortCollectionItemsByDate(filtered, sort);
		}
		
		return filtered;
	}, [items, filter, sort]);

	return {
		filteredItems,
		filter,
		setFilter,
		sort,
		setSort,
		view,
		setView,
	};
}

