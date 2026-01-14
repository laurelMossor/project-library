// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import { ProjectData, ProjectItem, ProjectUpdateInput } from "../../types/project";
import { projectWithOwnerFields } from "./fields";
import { deleteImage } from "./storage";
import { getActorIdForUser } from "./actor";
import { getImagesForTarget, getImagesForTargetsBatch, detachAllImagesForTarget } from "./image-attachment";
import { COLLECTION_ITEM_TYPES } from "@/lib/types/collection-base";

// Fetch a project by ID with owner information
export async function getProjectById(id: string): Promise<ProjectItem | null> {
	const project = await prisma.project.findUnique({
		where: { id },
		select: projectWithOwnerFields,
	});
	if (!project) return null;
	
	// Load images via ImageAttachment
	const images = await getImagesForTarget("PROJECT", id);
	
	// Add type field and images for TypeScript discrimination
	const projectItem: ProjectItem = {
		...project,
		type: COLLECTION_ITEM_TYPES.PROJECT,
		images,
	};
	return projectItem;
}

// Fetch all projects with optional basic text search
// Search matches title or description (case-insensitive partial match)
export async function getAllProjects(search?: string): Promise<ProjectItem[]> {
	const where = search
		? {
				OR: [
					{ title: { contains: search, mode: "insensitive" as const } },
					{ description: { contains: search, mode: "insensitive" as const } },
				],
			}
		: {};

	const projects = await prisma.project.findMany({
		where,
		select: projectWithOwnerFields,
		orderBy: { createdAt: "desc" }, // Most recent first
	});
	
	// Batch load images for all projects (fixes N+1 query problem)
	const projectIds = projects.map(p => p.id);
	const imagesMap = await getImagesForTargetsBatch("PROJECT", projectIds);
	
	// Attach images to projects
	const projectsWithImages: ProjectItem[] = projects.map((p) => {
		const images = imagesMap.get(p.id) || [];
		return {
			...p,
			type: COLLECTION_ITEM_TYPES.PROJECT,
			images,
		};
	});
	
	return projectsWithImages;
}

// Fetch all projects by a specific user (via their actor)
export async function getProjectsByUser(userId: string): Promise<ProjectItem[]> {
	const actorId = await getActorIdForUser(userId);
	if (!actorId) return [];
	return getProjectsByActor(actorId);
}

// Fetch all projects by a specific actor (works for both users and orgs)
export async function getProjectsByActor(actorId: string): Promise<ProjectItem[]> {
	const projects = await prisma.project.findMany({
		where: { ownerActorId: actorId },
		select: projectWithOwnerFields,
		orderBy: { createdAt: "desc" },
	});
	
	// Batch load images for all projects (fixes N+1 query problem)
	const projectIds = projects.map(p => p.id);
	const imagesMap = await getImagesForTargetsBatch("PROJECT", projectIds);
	
	// Attach images to projects
	const projectsWithImages: ProjectItem[] = projects.map((p) => {
		const images = imagesMap.get(p.id) || [];
		return {
			...p,
			type: COLLECTION_ITEM_TYPES.PROJECT,
			images,
		};
	});
	
	return projectsWithImages;
}

// Create a new project for a user (via their actor)
// Tags are optional - if not provided or empty, defaults appropriately
// Images should be uploaded separately and linked to the project via ImageAttachment
export async function createProject(ownerId: string, data: ProjectData): Promise<ProjectItem> {
	const actorId = await getActorIdForUser(ownerId);
	if (!actorId) {
		throw new Error("User not found or has no actor");
	}
	
	const project = await prisma.project.create({
		data: {
			title: data.title,
			description: data.description,
			tags: data.tags || [],
			ownerActorId: actorId,
		},
		select: projectWithOwnerFields,
	});
	
	// Load images via ImageAttachment
	const images = await getImagesForTarget("PROJECT", project.id);
	
	// Add type field and images for TypeScript discrimination
	const projectItem: ProjectItem = {
		...project,
		type: COLLECTION_ITEM_TYPES.PROJECT,
		images,
	};
	return projectItem;
}

// Update an existing project
export async function updateProject(id: string, data: ProjectUpdateInput): Promise<ProjectItem> {
	const updateData: {
		title?: string;
		description?: string;
		tags?: string[];
	} = {};

	if (data.title !== undefined) {
		updateData.title = data.title.trim();
	}
	if (data.description !== undefined) {
		updateData.description = data.description.trim();
	}
	if (data.tags !== undefined) {
		updateData.tags = data.tags;
	}

	// Ensure we have at least one field to update
	if (Object.keys(updateData).length === 0) {
		throw new Error("No fields to update");
	}

	try {
		const project = await prisma.project.update({
			where: { id },
			data: updateData,
			select: projectWithOwnerFields,
		});
		// Load images via ImageAttachment
		const images = await getImagesForTarget("PROJECT", project.id);
		
		// Add type field and images for TypeScript discrimination
		const projectItem: ProjectItem = {
			...project,
			type: COLLECTION_ITEM_TYPES.PROJECT,
			images,
		};
		return projectItem;
	} catch (error) {
		if (error instanceof Error) {
			// Check if it's a Prisma "Record not found" error
			if (error.message.includes("Record to update not found") || error.message.includes("Unique constraint")) {
				throw new Error("Project not found");
			}
			throw error;
		}
		throw new Error("Failed to update project in database");
	}
}

// Delete a project
export async function deleteProject(id: string): Promise<void> {
	// Fetch project to verify it exists
	const project = await prisma.project.findUnique({
		where: { id },
		select: { id: true },
	});

	if (!project) {
		throw new Error("Project not found");
	}

	// Get all images attached to this project
	const images = await getImagesForTarget("PROJECT", id);

	// Delete all associated images from storage bucket
	for (const image of images) {
		if (image.url) {
			const result = await deleteImage(image.url);
			if (!result.success) {
				console.error(`Failed to delete image ${image.id} from storage:`, result.error);
				// Continue deleting other images even if one fails
			}
		}
	}

	// Delete all image attachments (cascade will handle image deletion if needed)
	await detachAllImagesForTarget("PROJECT", id);

	// Delete the project (cascade will delete posts)
	await prisma.project.delete({
		where: { id },
	});
}


