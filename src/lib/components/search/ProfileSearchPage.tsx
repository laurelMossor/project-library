"use client";

import { useState, useEffect, useRef } from "react";
import { MIN_SEARCH_LENGTH, useProfileSearch } from "@/lib/hooks/useProfileSearch";
import { useColumnCount } from "@/lib/hooks/useColumnCount";
import { SearchResultCard } from "./SearchResultCard";
import type { SearchResultItem } from "@/lib/types/search";

export function ProfileSearchPage() {
	const [query, setQuery] = useState("");
	const { results, loading: isLoading, debouncedQuery } = useProfileSearch(query, "all");
	const inputRef = useRef<HTMLInputElement>(null);
	const columnCount = useColumnCount();

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	// Distribute results into columns (same pattern as FilteredCollection)
	const columns: SearchResultItem[][] = Array.from({ length: columnCount }, () => []);
	results.forEach((result, i) => columns[i % columnCount].push(result));

	const showHint = query.length > 0 && query.length < MIN_SEARCH_LENGTH;
	const showEmpty = !isLoading && debouncedQuery.length >= MIN_SEARCH_LENGTH && results.length === 0;

	return (
		<>
			<h1 className="text-2xl font-bold text-rich-brown mb-4">Profile Search</h1>

			<div className="relative mb-6 w-full">
				<input
					ref={inputRef}
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search by name or handle..."
					className="w-full border border-soft-grey rounded-lg p-3 text-sm focus:outline-none focus:border-dusty-grey transition-colors"
					autoComplete="off"
				/>
				{isLoading && (
					<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dusty-grey pointer-events-none">
						Searching...
					</span>
				)}
			</div>

			{showHint && (
				<p className="text-xs text-dusty-grey mb-4">Type at least 2 characters to search</p>
			)}

			{!query && (
				<p className="text-sm text-warm-grey">Find people and pages by name, handle, or interest.</p>
			)}

			{showEmpty && (
				<p className="text-sm text-dusty-grey">No results for &ldquo;{debouncedQuery}&rdquo;</p>
			)}

			{results.length > 0 && (
				<div className="flex gap-6">
					{columns.map((col, colIndex) => (
						<div key={colIndex} className="flex-1 min-w-0 space-y-6">
							{col.map((result) => (
								<SearchResultCard key={`${result.type}-${result.id}`} result={result} />
							))}
						</div>
					))}
				</div>
			)}
		</>
	);
}
