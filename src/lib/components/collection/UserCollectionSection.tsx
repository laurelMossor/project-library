"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { CollectionItem } from "@/lib/types/collection";
import { useFilter } from "@/lib/hooks/useFilter";
import { CollectionPage } from "./CollectionPage";

type UserCollectionSectionProps = {
	items: CollectionItem[];
	title?: string;
	emptyMessage?: string;
	showCreateLinks?: boolean;
};

export function UserCollectionSection({ 
	items, 
	title = "Your Collection",
	emptyMessage = "You haven't created any projects or events yet.",
	showCreateLinks = true
}: UserCollectionSectionProps) {
	const [search, setSearch] = useState("");

	// Filter items by search (client-side filtering for user's own collection)
	const filteredBySearch = useMemo(() => {
		if (!search.trim()) return items;
		
		const searchLower = search.toLowerCase();
		return items.filter((item) => {
			return (
				item.title.toLowerCase().includes(searchLower) ||
				item.description.toLowerCase().includes(searchLower) ||
				item.tags.some((tag) => tag.toLowerCase().includes(searchLower))
			);
		});
	}, [items, search]);

	// Use filter hook for filtering, sorting, and view state
	const { 
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
	} = useFilter(filteredBySearch);

	// Check if any events have location data for map view
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
						<Link href="/projects/new" className="underline">Create Project</Link>
						<Link href="/events/new" className="underline">Create Event</Link>
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
				filter={filter}
				onFilterChange={setFilter}
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

