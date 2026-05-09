import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

export interface FilterParamState {
	collectionType: FilterCollectionType;
	sort: SortType;
	view: ViewType;
	tags: string[];
	search: string;
}

/**
 * Bidirectional hook for collection filter URL params.
 * Reads filter state from the URL on mount, and provides updateUrl()
 * to write state changes back. Reusable across any collection view page.
 */
export function useFilterParams() {
	const searchParams = useSearchParams();
	const pathname = usePathname();
	const router = useRouter();

	const initialFilters = useMemo(
		() => parseFilterParams(searchParams),
		[searchParams]
	);

	const initialSearch = searchParams.get("search") ?? "";

	const updateUrl = useCallback((state: FilterParamState) => {
		const params = new URLSearchParams();
		if (state.collectionType !== "all") params.set("type", state.collectionType);
		if (state.sort !== "newest") params.set("sort", state.sort);
		if (state.view !== "grid") params.set("view", state.view);
		if (state.tags.length > 0) params.set("tags", state.tags.join(","));
		if (state.search) params.set("search", state.search);

		const qs = params.toString();
		const url = qs ? `${pathname}?${qs}` : pathname;
		router.replace(url);
		try { sessionStorage.setItem(`filterUrl:${pathname}`, url); } catch {}
	}, [pathname, router]);

	return {
		initialFilters,
		initialSearch,
		updateUrl,
	};
}

export function getPersistedFilterUrl(pathname: string, fallback: string): string {
	if (typeof window === "undefined") return fallback;
	try { return sessionStorage.getItem(`filterUrl:${pathname}`) ?? fallback; } catch { return fallback; }
}
