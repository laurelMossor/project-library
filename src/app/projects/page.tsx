"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProjectItem } from "@/lib/types/project";
import { CollectionCard } from "@/lib/components/collection/CollectionCard";
import { fetchProjects } from "@/lib/utils/project-client";
import { PageLayout } from "@/lib/components/layout/PageLayout";

export default function ProjectsPage() {
	const [projects, setProjects] = useState<ProjectItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");

	// Fetch projects when search changes (with debounce)
	useEffect(() => {
		const timeoutId = setTimeout(() => {
			loadProjects();
		}, 300); // Debounce search by 300ms

		return () => clearTimeout(timeoutId);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [search]);

	// Initial load
	useEffect(() => {
		loadProjects();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const loadProjects = async () => {
		setLoading(true);
		setError("");

		try {
			const data = await fetchProjects(search);
			setProjects(data);
		} catch (err) {
			setError("Failed to load projects");
		} finally {
			setLoading(false);
		}
	};


	return (
		<PageLayout>
			<div className="max-w-6xl mx-auto w-full">
				<div className="mb-8">
					<h1 className="text-3xl font-bold mb-4">Projects</h1>
					<input
						type="text"
						placeholder="Search projects..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full max-w-md border p-2 rounded"
					/>
				</div>

				{loading && (
					<div className="text-center py-12">
						<p>Loading projects...</p>
					</div>
				)}

				{error && (
					<div className="text-center py-12">
						<p className="text-red-500">{error}</p>
					</div>
				)}

				{!loading && !error && projects.length === 0 && (
					<div className="text-center py-12">
						<p>
							{search ? "No projects found matching your search." : "No projects yet. Be the first to create one!"}
						</p>
					</div>
				)}

				{!loading && !error && projects.length > 0 && (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{projects.map((project) => (
							<CollectionCard key={project.id} item={project} truncate={true} />
						))}
					</div>
				)}
			</div>
		</PageLayout>
	);
}

