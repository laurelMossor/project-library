"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CollectionItemCard } from "@/lib/components/collection/CollectionCard";
import { CollectionItem } from "@/lib/types/collection";
import { ProjectItem } from "@/lib/types/project";
import { EventItem } from "@/lib/types/event";
import { filterCollectionItems, sortCollectionItemsByDate, getCollectionItemKey } from "@/lib/utils/collection";

type FilterType = "all" | "projects" | "events";
type SortType = "newest" | "oldest";

export default function UserCollectionsPage() {
	const params = useParams();
	const username = params?.username as string;

	const [projects, setProjects] = useState<ProjectItem[]>([]);
	const [events, setEvents] = useState<EventItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [filter, setFilter] = useState<FilterType>("all");
	const [sort, setSort] = useState<SortType>("newest");

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

	// Combine and filter collections
	const filteredItems = useMemo(() => {
		const allItems: CollectionItem[] = [...projects, ...events];
		const filtered = filterCollectionItems(allItems, filter);
		return sortCollectionItemsByDate(filtered, sort);
	}, [projects, events, filter, sort]);

	return (
		<main className="flex min-h-screen flex-col p-8">
			<div className="max-w-6xl mx-auto w-full">
				{/* Header */}
				<div className="mb-8">
					<div className="mb-4">
						<Link href={`/u/${username}`} className="text-sm text-gray-600 hover:underline mb-2 inline-block">
							← Back to profile
						</Link>
						<h1 className="text-3xl font-bold">{username}'s Collections</h1>
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
								Projects ({projects.length})
							</button>
							<button
								onClick={() => setFilter("events")}
								className={`px-4 py-2 font-medium transition ${
									filter === "events"
										? "border-b-2 border-black text-black"
										: "text-gray-600 hover:text-black"
								}`}
							>
								Events ({events.length})
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
						</select>
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
							{filter === "all"
								? "No collections yet."
								: `No ${filter} yet.`}
						</p>
					</div>
				)}

				{/* Content display */}
				{!loading && !error && filteredItems.length > 0 && (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{filteredItems.map((item) => (
							<CollectionItemCard
								key={getCollectionItemKey(item)}
								item={item}
								truncate={true}
							/>
						))}
					</div>
				)}
			</div>
		</main>
	);
}

