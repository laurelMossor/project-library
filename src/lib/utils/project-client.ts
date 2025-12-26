import { ProjectItem } from "../types/project";

// CLIENT-SIDE FETCH UTILITIES
// These functions fetch from the API routes and can be used in client components
// This file is separate to avoid importing server-only Prisma code in client components

/**
 * Fetch all projects with optional search query
 * Client-side utility that calls the /api/projects endpoint
 */
export async function fetchProjects(search?: string): Promise<ProjectItem[]> {
	const url = search 
		? `/api/projects?search=${encodeURIComponent(search)}` 
		: "/api/projects";
	
	const res = await fetch(url);

	if (!res.ok) {
		throw new Error("Failed to fetch projects");
	}

	return res.json();
}

/**
 * Fetch a single project by ID
 * Client-side utility that calls the /api/projects/[id] endpoint
 */
export async function fetchProjectById(id: string): Promise<ProjectItem | null> {
	const res = await fetch(`/api/projects/${id}`);

	if (!res.ok) {
		if (res.status === 404) {
			return null;
		}
		throw new Error("Failed to fetch project");
	}

	return res.json();
}

