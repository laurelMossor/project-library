// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import type { PostItem, PostCreateInput, PostUpdateInput } from "@/lib/types/post";
import { getActorIdForUser } from "./actor";

/**
 * Fetch all posts for a project, sorted by createdAt (newest first)
 */
export async function getPostsForProject(projectId: string): Promise<PostItem[]> {
	const posts = await prisma.post.findMany({
		where: { projectId },
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			ownerActorId: true,
			projectId: true,
			eventId: true,
			title: true,
			content: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	return posts as PostItem[];
}

/**
 * Fetch all posts for an event, sorted by createdAt (newest first)
 */
export async function getPostsForEvent(eventId: string): Promise<PostItem[]> {
	const posts = await prisma.post.findMany({
		where: { eventId },
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			ownerActorId: true,
			projectId: true,
			eventId: true,
			title: true,
			content: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	return posts as PostItem[];
}

/**
 * Fetch all standalone posts (no projectId or eventId), sorted by createdAt (newest first)
 */
export async function getStandalonePosts(ownerActorId?: string): Promise<PostItem[]> {
	const where = ownerActorId
		? { projectId: null, eventId: null, ownerActorId }
		: { projectId: null, eventId: null };
	
	const posts = await prisma.post.findMany({
		where,
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			ownerActorId: true,
			projectId: true,
			eventId: true,
			title: true,
			content: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	return posts as PostItem[];
}

/**
 * Get a post by ID
 */
export async function getPostById(postId: string): Promise<PostItem | null> {
	const post = await prisma.post.findUnique({
		where: { id: postId },
		select: {
			id: true,
			ownerActorId: true,
			projectId: true,
			eventId: true,
			title: true,
			content: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	return post as PostItem | null;
}

/**
 * Create a new post
 * Can be standalone (no projectId/eventId) or descendant (one of projectId/eventId set)
 */
export async function createPost(
	ownerId: string,
	data: PostCreateInput
): Promise<PostItem> {
	// Validate content is not empty
	if (!data.content || data.content.trim().length === 0) {
		throw new Error("Content is required and cannot be empty");
	}

	// Validate that projectId and eventId are not both set
	if (data.projectId && data.eventId) {
		throw new Error("Post cannot belong to both a project and an event");
	}

	// Get actorId for the owner
	const actorId = await getActorIdForUser(ownerId);
	if (!actorId) {
		throw new Error("User not found or has no actor");
	}

	// If projectId is set, verify project exists
	if (data.projectId) {
		const project = await prisma.project.findUnique({
			where: { id: data.projectId },
			select: { id: true },
		});
		if (!project) {
			throw new Error("Project not found");
		}
	}

	// If eventId is set, verify event exists
	if (data.eventId) {
		const event = await prisma.event.findUnique({
			where: { id: data.eventId },
			select: { id: true },
		});
		if (!event) {
			throw new Error("Event not found");
		}
	}

	// Create the post
	const post = await prisma.post.create({
		data: {
			ownerActorId: actorId,
			projectId: data.projectId || null,
			eventId: data.eventId || null,
			title: data.title?.trim() || null,
			content: data.content.trim(),
		},
		select: {
			id: true,
			ownerActorId: true,
			projectId: true,
			eventId: true,
			title: true,
			content: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	return post as PostItem;
}

/**
 * Update an existing post
 */
export async function updatePost(
	postId: string,
	data: PostUpdateInput
): Promise<PostItem> {
	const updateData: {
		title?: string | null;
		content?: string;
	} = {};

	if (data.title !== undefined) {
		updateData.title = data.title?.trim() || null;
	}

	if (data.content !== undefined) {
		if (!data.content || data.content.trim().length === 0) {
			throw new Error("Content cannot be empty");
		}
		updateData.content = data.content.trim();
	}

	// Ensure we have at least one field to update
	if (Object.keys(updateData).length === 0) {
		throw new Error("No fields to update");
	}

	try {
		const post = await prisma.post.update({
			where: { id: postId },
			data: updateData,
			select: {
				id: true,
				ownerActorId: true,
				projectId: true,
				eventId: true,
				title: true,
				content: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		return post as PostItem;
	} catch (error) {
		if (error instanceof Error) {
			if (error.message.includes("Record to update not found")) {
				throw new Error("Post not found");
			}
			throw error;
		}
		throw new Error("Failed to update post in database");
	}
}

/**
 * Delete a post
 */
export async function deletePost(postId: string): Promise<void> {
	await prisma.post.delete({
		where: { id: postId },
	});
}

