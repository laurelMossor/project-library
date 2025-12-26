"use client";

import { useState, useEffect, useMemo } from "react";
import { CollectionCard } from "@/lib/components/collection/CollectionCard";
import { CollectionItem } from "@/lib/types/collection";
import { fetchProjects } from "@/lib/utils/project-client";
import { fetchEvents } from "@/lib/utils/event-client";
import { Project } from "@/lib/types/project";
import { Event } from "@/lib/types/event";
import { filterCollectionItems, sortCollectionItemsByDate, getCollectionItemKey } from "@/lib/utils/collection";

type FilterType = "all" | "projects" | "events";
type SortType = "newest" | "oldest" | "relevance";
type ViewType = "grid" | "list" | "map";

export default function CollectionsPage() {
	const [projects, setProjects] = useState<Project[]>([]);
	const [events, setEvents] = useState<Event[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<FilterType>("all");
	const [sort, setSort] = useState<SortType>("newest");
	const [view, setView] = useState<ViewType>("grid");

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

	// Combine and filter collections
	const filteredItems = useMemo(() => {
		const allItems: CollectionItem[] = [...projects, ...events];
		const filtered = filterCollectionItems(allItems, filter);
		
		// Sort items (relevance is handled by API search, so no sorting needed)
		if (sort === "newest" || sort === "oldest") {
			return sortCollectionItemsByDate(filtered, sort);
		}
		
		return filtered;
	}, [projects, events, filter, sort]);

	const hasLocationData = events.some((e) => e.latitude !== null && e.longitude !== null);

	return (
		<main className="flex min-h-screen flex-col p-8">
			<div className="max-w-6xl mx-auto w-full">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-3xl font-bold mb-4">Collections</h1>

					{/* Search bar */}
					<div className="mb-4">
						<input
							type="text"
							placeholder="Search projects and events..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="w-full max-w-md border p-2 rounded"
						/>
					</div>

					{/* Filter tabs */}
					<div className="flex flex-wrap items-center gap-4 mb-4">
						<div className="flex gap-2 border-b">
							<button
								onClick={() => setFilter("all")}
								className={`px-4 py-2 font-medium transition ${
									filter === "all"
										? "border-b-2 border-black text-black"
										: "text-gray-600 hover:text-black"
								}`}
							>
								All
							</button>
							<button
								onClick={() => setFilter("projects")}
								className={`px-4 py-2 font-medium transition ${
									filter === "projects"
										? "border-b-2 border-black text-black"
										: "text-gray-600 hover:text-black"
								}`}
							>
								Projects
							</button>
							<button
								onClick={() => setFilter("events")}
								className={`px-4 py-2 font-medium transition ${
									filter === "events"
										? "border-b-2 border-black text-black"
										: "text-gray-600 hover:text-black"
								}`}
							>
								Events
							</button>
						</div>

						{/* Sort dropdown */}
						<select
							value={sort}
							onChange={(e) => setSort(e.target.value as SortType)}
							className="border p-2 rounded text-sm"
						>
							<option value="newest">Newest First</option>
							<option value="oldest">Oldest First</option>
							<option value="relevance">Relevance</option>
						</select>

						{/* View toggle */}
						<div className="flex gap-2 ml-auto">
							<button
								onClick={() => setView("grid")}
								className={`px-3 py-1 text-sm border rounded transition ${
									view === "grid" ? "bg-black text-white" : "bg-white"
								}`}
							>
								Grid
							</button>
							<button
								onClick={() => setView("list")}
								className={`px-3 py-1 text-sm border rounded transition ${
									view === "list" ? "bg-black text-white" : "bg-white"
								}`}
							>
								List
							</button>
							{hasLocationData && (
								<button
									onClick={() => setView("map")}
									className={`px-3 py-1 text-sm border rounded transition ${
										view === "map" ? "bg-black text-white" : "bg-white"
									}`}
								>
									Map
								</button>
							)}
						</div>
					</div>
				</div>

				{/* Loading state */}
				{loading && (
					<div className="text-center py-12">
						<p>Loading collections...</p>
					</div>
				)}

				{/* Error state */}
				{error && (
					<div className="text-center py-12">
						<p className="text-red-500">{error}</p>
					</div>
				)}

				{/* Empty state */}
				{!loading && !error && filteredItems.length === 0 && (
					<div className="text-center py-12">
						<p>
							{search
								? `No ${filter === "all" ? "items" : filter} found matching your search.`
								: `No ${filter === "all" ? "collections" : filter} yet. Be the first to create one!`}
						</p>
					</div>
				)}

				{/* Content display */}
				{!loading && !error && filteredItems.length > 0 && (
					<>
						{view === "map" ? (
							<div className="text-center py-12">
								<p className="text-gray-600 mb-4">Map view coming soon</p>
								<p className="text-sm text-gray-500">
									{filteredItems.length} {filteredItems.length === 1 ? "item" : "items"} found
								</p>
							</div>
						) : view === "list" ? (
							<div className="space-y-4">
								{filteredItems.map((item) => (
									<CollectionCard key={getCollectionItemKey(item)} item={item} />
								))}
							</div>
						) : (
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
								{filteredItems.map((item) => (
									<CollectionCard
										key={getCollectionItemKey(item)}
										item={item}
										truncate={true}
									/>
								))}
							</div>
						)}
					</>
				)}
			</div>
		</main>
	);
}

