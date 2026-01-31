import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { FILTER_COLLECTION_TYPES, FilterCollectionType } from "@/lib/types/collection";
import { SortType, ViewType, FilterInitialValues } from "./useFilter";

// Valid values for URL params
const VALID_TYPES = Object.values(FILTER_COLLECTION_TYPES) as FilterCollectionType[];
const VALID_SORTS: SortType[] = ["newest", "oldest", "relevance"];
const VALID_VIEWS: ViewType[] = ["grid", "list", "map"];

function parseFilterParams(searchParams: URLSearchParams): FilterInitialValues {
	const typeParam = searchParams.get("type");
	const sortParam = searchParams.get("sort");
	const viewParam = searchParams.get("view");
	const tagsParam = searchParams.get("tags");

	return {
		collectionType: VALID_TYPES.includes(typeParam as FilterCollectionType)
			? (typeParam as FilterCollectionType)
			: undefined,
		sort: VALID_SORTS.includes(sortParam as SortType)
			? (sortParam as SortType)
			: undefined,
		view: VALID_VIEWS.includes(viewParam as ViewType)
			? (viewParam as ViewType)
			: undefined,
		tags: tagsParam ? tagsParam.split(",").filter(Boolean) : undefined,
	};
}

/**
 * example_1: /explore?type=project&sort=newest&view=grid&tags=tag1,tag2&search=query
 * example_2: /explore?type=event&sort=newest&view=map&tags=improv
 * example_3: /explore?type=post&sort=relevance&view=map&tags=tag1,tag2&search=query
 * example_4: /explore?type=all&sort=newest&view=grid&tags=tag1,tag2&search=query
 * example_5: /explore?type=all&sort=oldest&view=list&tags=tag1,tag2&search=query
 * example_6: /explore?type=all&sort=relevance&view=map&tags=tag1,tag2&search=query
 * example_7: /explore?type=all&sort=newest&view=grid&tags=tag1,tag2&search=query
 * example_8: /explore?type=all&sort=oldest&view=list&tags=tag1,tag2&search=query
 */
/**
 * Hook to parse filter parameters from URL search params
 * Supports: ?type=project&sort=newest&view=grid&tags=tag1,tag2&search=query
 */
export function useFilterParams() {
	const searchParams = useSearchParams();

	const initialFilters = useMemo(
		() => parseFilterParams(searchParams),
		[searchParams]
	);

	const initialSearch = searchParams.get("search") ?? "";

	return {
		initialFilters,
		initialSearch,
	};
}
