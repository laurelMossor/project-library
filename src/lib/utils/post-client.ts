import { PostItem, PostCollectionItem } from "../types/post";
import { API_POSTS, API_POST_POSTS, API_EVENT_POSTS } from "../const/routes";

// CLIENT-SIDE READS for views that still fetch on the client (Explore, child-post lists).
// Saves are Server Actions in src/lib/actions/post.ts.

/**
 * Fetch posts for an event
 */
export async function getEventPosts(eventId: string): Promise<PostItem[]> {
	const endpoint = API_EVENT_POSTS(eventId);
	const response = await fetch(endpoint);

	if (!response.ok) {
		throw new Error(`Failed to fetch posts: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Fetch child posts (updates) for a parent post
 */
export async function getPostUpdates(parentPostId: string): Promise<PostItem[]> {
	const response = await fetch(API_POST_POSTS(parentPostId));

	if (!response.ok) {
		throw new Error(`Failed to fetch post updates: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Fetch all posts with optional search query
 * Client-side utility that calls the /api/posts endpoint
 */
export async function fetchPosts(search?: string): Promise<PostCollectionItem[]> {
	const params = new URLSearchParams({ toplevel: "true" });
	if (search) params.set("search", search);
	const url = `${API_POSTS}?${params.toString()}`;

	const res = await fetch(url);

	if (!res.ok) {
		throw new Error("Failed to fetch posts");
	}

	return res.json();
}
