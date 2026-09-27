"use client";

import { useEffect, useState } from "react";
import { useDebounce } from "./useDebounce";
import { API_SEARCH_PROFILES } from "@/lib/const/routes";
import type { SearchResultItem } from "@/lib/types/search";

/** Queries shorter than this aren't sent (the API returns nothing for them either). */
export const MIN_SEARCH_LENGTH = 2;

/**
 * Debounced profile search against /api/search/profiles — the one implementation behind the profile
 * search page, the member-add dropdown, and the group member picker. A response for a superseded query
 * is ignored, so fast typing never shows stale results.
 */
export function useProfileSearch(query: string, type: "user" | "page" | "all" = "all", delay = 300) {
	const debouncedQuery = useDebounce(query.trim(), delay);
	const [results, setResults] = useState<SearchResultItem[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (debouncedQuery.length < MIN_SEARCH_LENGTH) {
			setResults([]);
			setLoading(false);
			return;
		}
		let cancelled = false;
		setLoading(true);
		fetch(API_SEARCH_PROFILES(debouncedQuery, type))
			.then((res) => (res.ok ? res.json() : { results: [] }))
			.then((data) => { if (!cancelled) setResults(data.results ?? []); })
			.catch(() => { if (!cancelled) setResults([]); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [debouncedQuery, type]);

	return { results, loading, debouncedQuery };
}
