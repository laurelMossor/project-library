"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { CollectionItem } from "@/lib/types/collection";
import { useFilter } from "@/lib/hooks/useFilter";
import { CollectionPage } from "./CollectionPage";
import { EVENT_NEW } from "@/lib/const/routes";

type ProfileCollectionSectionProps = {
	items: CollectionItem[];
	title?: string;
	emptyMessage?: string;
	showCreateLinks?: boolean;
};

/**
 * ProfileCollectionSection — shared collection section for User and Page profile pages.
 * Renders a filterable, sortable grid of events/posts belonging to a profile entity.
 */
export function ProfileCollectionSection({
	items,
	title = "Collection",
	emptyMessage = "Nothing here yet.",
	showCreateLinks = true
}: ProfileCollectionSectionProps) {
	const [search, setSearch] = useState("");

	// Filter items by search (client-side filtering for profile's own collection)
	const filteredBySearch = useMemo(() => {
		if (!search.trim()) return items;

		const searchLower = search.toLowerCase();
		return items.filter((item) => {
			return (
				(item.title || "").toLowerCase().includes(searchLower) ||
				item.content.toLowerCase().includes(searchLower) ||
				item.tags.some((tag) => tag.toLowerCase().includes(searchLower))
			);
		});
	}, [items, search]);

	const {
		filteredItems,
		collectionTypeFilter,
		setCollectionTypeFilter,
		sort,
		setSort,
		view,
		setView,
		selectedTags,
		setSelectedTags,
		availableTags,
	} = useFilter(filteredBySearch);

	const hasLocationData = useMemo(
		() => items.some((item) => {
			if ("latitude" in item && "longitude" in item) {
				return item.latitude !== null && item.longitude !== null;
			}
			return false;
		}),
		[items]
	);

	if (items.length === 0) {
		return (
			<div className="mt-8 pt-8 border-t">
				<h2 className="text-xl font-semibold mb-4">{title}</h2>
				<p className="text-gray-500">{emptyMessage}</p>
				{showCreateLinks && (
					<div className="mt-4 flex gap-4">
						<Link href={EVENT_NEW} className="underline">Create Event</Link>
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="mt-8 pt-8 border-t">
			<CollectionPage
				filteredItems={filteredItems}
				loading={false}
				error=""
				search={search}
				onSearchChange={setSearch}
				collectionTypeFilter={collectionTypeFilter}
				onCollectionTypeChange={setCollectionTypeFilter}
				sort={sort}
				onSortChange={setSort}
				view={view}
				onViewChange={setView}
				hasLocationData={hasLocationData}
				selectedTags={selectedTags}
				onTagsChange={setSelectedTags}
				availableTags={availableTags}
				title={title}
			/>
		</div>
	);
}
