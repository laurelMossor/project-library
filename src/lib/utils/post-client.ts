import { PostItem, toPostCollectionItem, PostCollectionItem } from "../types/post";
import { API_POSTS, API_EVENT_POSTS } from "../const/routes";

/**
 * Fetch posts for an event
 */
export async function getPosts(eventId: string): Promise<PostItem[]> {
	const endpoint = API_EVENT_POSTS(eventId);
	const response = await fetch(endpoint);

	if (!response.ok) {
		throw new Error(`Failed to fetch posts: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Fetch all posts with optional search query
 * Client-side utility that calls the /api/posts endpoint
 */
export async function fetchPosts(search?: string): Promise<PostCollectionItem[]> {
	const url = search
		? `${API_POSTS}?search=${encodeURIComponent(search)}`
		: API_POSTS;

	const res = await fetch(url);

	if (!res.ok) {
		throw new Error("Failed to fetch posts");
	}

	const posts: PostItem[] = await res.json();
	return posts.map(toPostCollectionItem);
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
	const res = await fetch(API_POSTS, {
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
