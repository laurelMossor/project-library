"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Project {
	id: string;
	title: string;
	description: string;
	tags: string[];
	createdAt: string;
	owner: {
		id: string;
		username: string;
		name: string | null;
	};
}

export default function ProjectsPage() {
	const router = useRouter();
	const [projects, setProjects] = useState<Project[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");

	// Fetch projects when search changes (with debounce)
	useEffect(() => {
		const timeoutId = setTimeout(() => {
			fetchProjects();
		}, 300); // Debounce search by 300ms

		return () => clearTimeout(timeoutId);
	}, [search]);

	// Initial load
	useEffect(() => {
		fetchProjects();
	}, []);

	const fetchProjects = async () => {
		setLoading(true);
		setError("");

		try {
			const url = search ? `/api/projects?search=${encodeURIComponent(search)}` : "/api/projects";
			const res = await fetch(url);

			if (!res.ok) {
				throw new Error("Failed to fetch projects");
			}

			const data = await res.json();
			setProjects(data);
		} catch (err) {
			setError("Failed to load projects");
		} finally {
			setLoading(false);
		}
	};

	const truncateDescription = (text: string, maxLength: number = 150) => {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength) + "...";
	};

	return (
		<main className="flex min-h-screen flex-col p-8">
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
						<p className="text-gray-600">Loading projects...</p>
					</div>
				)}

				{error && (
					<div className="text-center py-12">
						<p className="text-red-500">{error}</p>
					</div>
				)}

				{!loading && !error && projects.length === 0 && (
					<div className="text-center py-12">
						<p className="text-gray-600">
							{search ? "No projects found matching your search." : "No projects yet. Be the first to create one!"}
						</p>
					</div>
				)}

				{!loading && !error && projects.length > 0 && (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{projects.map((project) => (
							<div
								key={project.id}
								onClick={() => router.push(`/projects/${project.id}`)}
								className="border rounded p-4 hover:shadow-lg transition-shadow cursor-pointer"
							>
								<h2 className="text-xl font-semibold mb-2">{project.title}</h2>
								<p className="text-gray-600 mb-3">{truncateDescription(project.description)}</p>

								{project.tags && project.tags.length > 0 && (
									<div className="mb-3 flex flex-wrap gap-2">
										{project.tags.map((tag) => (
											<span
												key={tag}
												className="px-2 py-1 bg-gray-100 rounded text-xs"
											>
												{tag}
											</span>
										))}
									</div>
								)}

								<div className="text-sm text-gray-500">
									<p>
										By{" "}
										<Link
											href={`/u/${project.owner.username}`}
											onClick={(e) => e.stopPropagation()}
											className="underline hover:text-gray-700"
										>
											{project.owner.name || project.owner.username}
										</Link>
									</p>
									<p className="mt-1">
										{new Date(project.createdAt).toLocaleDateString()}
									</p>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</main>
	);
}

