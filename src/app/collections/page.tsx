"use client";

import { useState, useEffect, useMemo } from "react";
import { CollectionItem } from "@/lib/types/collection";
import { fetchProjects } from "@/lib/utils/project-client";
import { fetchEvents } from "@/lib/utils/event-client";
import { ProjectItem } from "@/lib/types/project";
import { EventItem } from "@/lib/types/event";
import { useFilter } from "@/lib/hooks/useFilter";
import { CollectionPage } from "@/lib/components/collection/CollectionPage";
import { PageLayout } from "@/lib/components/layout/PageLayout";

export default function CollectionsPage() {
	const [projects, setProjects] = useState<ProjectItem[]>([]);
	const [events, setEvents] = useState<EventItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");

	// Combine all items for filtering
	const allItems: CollectionItem[] = useMemo(() => [...projects, ...events], [projects, events]);

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
	} = useFilter(allItems);

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
			const [projectsData, eventsData] = await Promise.all([
				fetchProjects(search || undefined),
				fetchEvents(search || undefined),
			]);
			setProjects(projectsData);
			setEvents(eventsData);
		} catch (err) {
			setError("Failed to load collections");
		} finally {
			setLoading(false);
		}
	};

	return (
		<PageLayout>
			<CollectionPage
				filteredItems={filteredItems}
				loading={loading}
				error={error}
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
			/>
		</PageLayout>
	);
}

