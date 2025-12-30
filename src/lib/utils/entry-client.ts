import type { EntryItem } from "@/lib/types/entry";
import type { CollectionType } from "@/lib/types/collection";

// CLIENT-SIDE FETCH UTILITIES
// These functions fetch from the API routes and can be used in client components

/**
 * Fetch all entries for a collection (project, event, etc.)
 * Client-side utility that calls the appropriate API endpoint based on collectionType
 */
export async function getEntries(
	collectionId: string,
	collectionType: CollectionType
): Promise<EntryItem[]> {
	let endpoint: string;
	
	if (collectionType === "project") {
		endpoint = `/api/projects/${collectionId}/entries`;
	} else if (collectionType === "event") {
		endpoint = `/api/events/${collectionId}/entries`;
	} else {
		throw new Error(`Unsupported collection type: ${collectionType}`);
	}

	const res = await fetch(endpoint);

	if (!res.ok) {
		if (res.status === 404) {
			return [];
		}
		throw new Error("Failed to fetch entries");
	}

	return res.json();
}

