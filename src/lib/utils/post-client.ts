/**
 * Client-side utilities for fetching posts
 */

import { PostItem } from "../types/post";

/**
 * Fetch posts for an event
 */
export async function getPosts(
	eventId: string,
): Promise<PostItem[]> {
	const endpoint = `/api/events/${eventId}/posts`;

	const response = await fetch(endpoint);

	if (!response.ok) {
		throw new Error(`Failed to fetch posts: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Fetch a single post by ID
 */
export async function getPostById(postId: string): Promise<PostItem> {
	const response = await fetch(`/api/posts/${postId}`);

	if (!response.ok) {
		throw new Error(`Failed to fetch post: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Create a new post for an event
 */
export async function createPost(
	eventId: string,
	data: { title?: string | null; content: string }
): Promise<PostItem> {
	const endpoint = `/api/events/${eventId}/posts`;

	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(data),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: "Failed to create post" }));
		throw new Error(error.error || "Failed to create post");
	}

	return response.json();
}

/**
 * Update an existing post
 */
export async function updatePost(
	postId: string,
	data: { title?: string | null; content?: string }
): Promise<PostItem> {
	const response = await fetch(`/api/posts/${postId}`, {
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(data),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: "Failed to update post" }));
		throw new Error(error.error || "Failed to update post");
	}

	return response.json();
}

/**
 * Delete a post
 */
export async function deletePost(postId: string): Promise<void> {
	const response = await fetch(`/api/posts/${postId}`, {
		method: "DELETE",
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: "Failed to delete post" }));
		throw new Error(error.error || "Failed to delete post");
	}
}
