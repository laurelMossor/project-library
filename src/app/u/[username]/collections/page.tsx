"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CollectionItem } from "@/lib/types/collection";
import { ProjectItem } from "@/lib/types/project";
import { EventItem } from "@/lib/types/event";
import { useFilter } from "@/lib/hooks/useFilter";
import { CollectionPage } from "@/lib/components/collection/CollectionPage";

export default function UserCollectionsPage() {
	const params = useParams();
	const username = params?.username as string;

	const [projects, setProjects] = useState<ProjectItem[]>([]);
	const [events, setEvents] = useState<EventItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");

	useEffect(() => {
		if (username) {
			loadUserCollections();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [username]);

	const loadUserCollections = async () => {
		setLoading(true);
		setError("");

		try {
			// Fetch user's projects and events
			const [projectsRes, eventsRes] = await Promise.all([
				fetch(`/api/users/${username}/projects`),
				fetch(`/api/users/${username}/events`),
			]);

			if (!projectsRes.ok && projectsRes.status !== 404) {
				throw new Error("Failed to load projects");
			}
			if (!eventsRes.ok && eventsRes.status !== 404) {
				throw new Error("Failed to load events");
			}

			const projectsData = projectsRes.ok ? await projectsRes.json() : [];
			const eventsData = eventsRes.ok ? await eventsRes.json() : [];

			setProjects(projectsData);
			setEvents(eventsData);
		} catch (err) {
			setError("Failed to load collections");
		} finally {
			setLoading(false);
		}
	};

	// Combine collections
	const allItems: CollectionItem[] = useMemo(() => {
		return [...projects, ...events];
	}, [projects, events]);

	// Filter items by search
	const filteredBySearch = useMemo(() => {
		if (!search.trim()) return allItems;
		
		const searchLower = search.toLowerCase();
		return allItems.filter((item) => {
			return (
				item.title.toLowerCase().includes(searchLower) ||
				item.description.toLowerCase().includes(searchLower) ||
				item.tags.some((tag) => tag.toLowerCase().includes(searchLower))
			);
		});
	}, [allItems, search]);

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
		() => allItems.some((item) => {
			if ("latitude" in item && "longitude" in item) {
				return item.latitude !== null && item.longitude !== null;
			}
			return false;
		}),
		[allItems]
	);

	return (
		<main className="flex min-h-screen flex-col p-8">
			<div className="max-w-6xl mx-auto w-full">
				<div className="mb-4">
					<Link href={`/u/${username}`} className="text-sm text-gray-600 hover:underline mb-2 inline-block">
						← Back to profile
					</Link>
				</div>
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
					title={`${username}'s Collections`}
				/>
			</div>
		</main>
	);
}

