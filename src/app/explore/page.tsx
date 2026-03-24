"use client";

import { useState, useEffect, useMemo } from "react";
import { CollectionItem } from "@/lib/types/collection";
import { fetchEvents } from "@/lib/utils/event-client";
import { fetchPosts } from "@/lib/utils/post-client";
import { EventItem } from "@/lib/types/event";
import { PostCollectionItem } from "@/lib/types/post";
import { useFilter } from "@/lib/hooks/useFilter";
import { useFilterParams } from "@/lib/hooks/useFilterParams";
import { CollectionPage } from "@/lib/components/collection/CollectionPage";
import { PageLayout } from "@/lib/components/layout/PageLayout";

export default function ExplorePage() {
	const { initialFilters, initialSearch } = useFilterParams();

	const [events, setEvents] = useState<EventItem[]>([]);
	const [posts, setPosts] = useState<PostCollectionItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [hasLoaded, setHasLoaded] = useState(false);
	const [error, setError] = useState("");
	const [search, setSearch] = useState(initialSearch);

	// All items for filtering
	const allItems: CollectionItem[] = useMemo(() => [...events, ...posts], [events, posts]);

	// Use filter hook for filtering, sorting, and view state
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
	} = useFilter(allItems, initialFilters);

	// Check if any events have location data for map view
	const hasLocationData = useMemo(
		() => events.some((e) => e.latitude !== null && e.longitude !== null),
		[events]
	);

	// Debounced search
	useEffect(() => {
		const timeoutId = setTimeout(() => {
			loadCollections();
		}, 300);

		return () => clearTimeout(timeoutId);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [search]);

	// Initial load
	useEffect(() => {
		loadCollections();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const loadCollections = async () => {
		setLoading(true);
		setError("");

		try {
			const [eventsData, postsData] = await Promise.all([
				fetchEvents(search || undefined),
				fetchPosts(search || undefined),
			]);
			setEvents(eventsData);
			setPosts(postsData);
		} catch (err) {
			setError("Failed to load collections");
		} finally {
			setLoading(false);
			setHasLoaded(true);
		}
	};

	return (
		<PageLayout>
			<CollectionPage
				title="Explore"
				filteredItems={filteredItems}
				loading={loading}
				error={error}
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
			/>
		</PageLayout>
	);
}
