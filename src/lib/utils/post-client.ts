import { PostItem, PostCollectionItem } from "../types/post";
import { API_POSTS, API_POST, API_EVENT_POSTS } from "../const/routes";
import { authFetch } from "./auth-client";

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
	const response = await fetch(`${API_POSTS}?parentPostId=${parentPostId}`);

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

/**
 * Fetch a single post by ID
 */
export async function fetchPostById(id: string): Promise<PostItem | null> {
	const res = await fetch(`${API_POSTS}/${id}`);

	if (!res.ok) {
		if (res.status === 404) {
			return null;
		}
		throw new Error("Failed to fetch post");
	}

	return res.json();
}

/**
 * Create a new post
 */
export async function createPost(data: {
	content: string;
	title?: string;
	pageId?: string;
	eventId?: string;
	parentPostId?: string;
	tags?: string[];
}): Promise<PostItem> {
	const res = await authFetch(API_POSTS, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});

	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}));
		throw new Error(errorData.error || "Failed to create post");
	}

	return res.json();
}

/**
 * Update a post's fields (batched patch)
 */
export async function updatePost(
	id: string,
	data: Partial<{ title: string | null; content: string; tags: string[]; status: string }>
): Promise<PostItem> {
	const res = await authFetch(API_POST(id), {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});

	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}));
		throw new Error(errorData.error || "Failed to update post");
	}

	return res.json();
}

/**
 * Publish a post (flip status DRAFT → PUBLISHED)
 */
export async function publishPost(id: string): Promise<PostItem> {
	return updatePost(id, { status: "PUBLISHED" });
}

/**
 * Delete a post
 */
export async function deletePost(id: string): Promise<void> {
	const res = await authFetch(API_POST(id), { method: "DELETE" });
	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}));
		throw new Error(errorData.error || "Failed to delete post");
	}
}
