"use client";

import { useState, useEffect, useRef } from "react";
import { MIN_SEARCH_LENGTH, useProfileSearch } from "@/lib/hooks/useProfileSearch";
import { useColumnCount } from "@/lib/hooks/useColumnCount";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { FollowButton } from "@/lib/components/profile/FollowButton";
import { Tag } from "@/lib/components/tag/Tag";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { PUBLIC_PROFILE } from "@/lib/const/routes";
import { searchResultEntity, type SearchResultItem } from "@/lib/types/search";

/** One person or page: the whole card opens the profile; Follow and View are their own buttons. */
function ProfileResult({ result }: { result: SearchResultItem }) {
	return (
		<ProfileTag
			variant="card"
			size="lg"
			entity={searchResultEntity(result)}
			details={
				<>
					{result.headline && <p className="text-xs text-warm-grey line-clamp-2">{result.headline}</p>}
					{result.interests.length > 0 && (
						<div className="flex flex-wrap gap-1 mt-1">
							{result.interests.slice(0, 3).map((interest) => (
								<Tag key={interest} tag={interest} />
							))}
						</div>
					)}
				</>
			}
			actions={
				<>
					<FollowButton
						size="sm"
						entityId={result.id}
						entityType={result.type}
						profileVisibility={result.profileVisibility}
					/>
					<ButtonLink href={PUBLIC_PROFILE(result.handle)} variant="secondary" size="sm">
						View
					</ButtonLink>
				</>
			}
		/>
	);
}

/** Cards in columns (same pattern as FilteredCollection). */
function ResultColumns({ items, columnCount }: { items: SearchResultItem[]; columnCount: number }) {
	const columns: SearchResultItem[][] = Array.from({ length: columnCount }, () => []);
	items.forEach((item, i) => columns[i % columnCount].push(item));
	return (
		<div className="flex gap-6">
			{columns.map((col, colIndex) => (
				<div key={colIndex} className="flex-1 min-w-0 space-y-6">
					{col.map((result) => (
						<ProfileResult key={`${result.type}-${result.id}`} result={result} />
					))}
				</div>
			))}
		</div>
	);
}

type ProfileSearchPageProps = {
	/** PUBLIC profiles to show before anyone types (see suggestProfiles). */
	suggestions?: SearchResultItem[];
};

export function ProfileSearchPage({ suggestions = [] }: ProfileSearchPageProps) {
	const [query, setQuery] = useState("");
	const { results, loading: isLoading, debouncedQuery } = useProfileSearch(query, "all");
	const inputRef = useRef<HTMLInputElement>(null);
	const columnCount = useColumnCount();

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const showHint = query.length > 0 && query.length < MIN_SEARCH_LENGTH;
	const showEmpty = !isLoading && debouncedQuery.length >= MIN_SEARCH_LENGTH && results.length === 0;

	return (
		<>
			<h1 className="text-2xl font-bold text-rich-brown mb-4">Find people</h1>

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
				<>
					<p className="text-sm text-warm-grey mb-4">Find people and pages by name, handle, or interest.</p>
					{suggestions.length > 0 && (
						<section aria-label="People to meet">
							<h2 className="text-sm font-medium text-dusty-grey mb-3">People to meet</h2>
							<ResultColumns items={suggestions} columnCount={columnCount} />
						</section>
					)}
				</>
			)}

			{showEmpty && (
				<p className="text-sm text-dusty-grey">No results for &ldquo;{debouncedQuery}&rdquo;</p>
			)}

			{results.length > 0 && <ResultColumns items={results} columnCount={columnCount} />}
		</>
	);
}
