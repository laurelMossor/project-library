import { ProjectEntryItem } from "./project-entry";

// CLIENT-SIDE FETCH UTILITIES
// These functions fetch from the API routes and can be used in client components

/**
 * Fetch all entries for a project
 * Client-side utility that calls the /api/projects/[id]/entries endpoint
 */
export async function fetchProjectEntries(projectId: string): Promise<ProjectEntryItem[]> {
	const res = await fetch(`/api/projects/${projectId}/entries`);

	if (!res.ok) {
		if (res.status === 404) {
			return [];
		}
		throw new Error("Failed to fetch project entries");
	}

	return res.json();
}

