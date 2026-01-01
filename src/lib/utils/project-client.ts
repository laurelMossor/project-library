import { ProjectItem } from "../types/project";
import { API_PROJECTS, API_PROJECT } from "../const/routes";

// CLIENT-SIDE FETCH UTILITIES
// These functions fetch from the API routes and can be used in client components
// This file is separate to avoid importing server-only Prisma code in client components

/**
 * Fetch all projects with optional search query
 * Client-side utility that calls the /api/projects endpoint
 */
export async function fetchProjects(search?: string): Promise<ProjectItem[]> {
	const url = search 
		? `${API_PROJECTS}?search=${encodeURIComponent(search)}` 
		: API_PROJECTS;
	
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
	const res = await fetch(API_PROJECT(id));

	if (!res.ok) {
		if (res.status === 404) {
			return null;
		}
		throw new Error("Failed to fetch project");
	}

	return res.json();
}

/**
 * Update a project by ID
 * Client-side utility that calls the PUT /api/projects/[id] endpoint
 */
export async function updateProject(
	id: string,
	data: {
		title?: string;
		description?: string;
		tags?: string[];
	}
): Promise<ProjectItem> {
	const res = await fetch(API_PROJECT(id), {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});

	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}));
		throw new Error(errorData.error || "Failed to update project");
	}

	return res.json();
}

/**
 * Delete a project by ID
 * Client-side utility that calls the DELETE /api/projects/[id] endpoint
 */
export async function deleteProject(id: string): Promise<void> {
	const res = await fetch(API_PROJECT(id), {
		method: "DELETE",
	});

	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}));
		throw new Error(errorData.error || "Failed to delete project");
	}
}

