// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import { ProjectData, ProjectItem, ProjectUpdateInput } from "../../types/project";
import { projectWithOwnerFields, ProjectFromQuery } from "./fields";
import { deleteImage } from "./storage";
import { getImagesForTarget, getImagesForTargetsBatch, detachAllImagesForTarget } from "./image-attachment";
import { COLLECTION_ITEM_TYPES } from "@/lib/types/collection-base";
import type { ImageItem } from "@/lib/types/image";

/** Transform Prisma query result to ProjectItem */
function toProjectItem(project: ProjectFromQuery, images: ImageItem[]): ProjectItem {
	return {
		...project,
		type: COLLECTION_ITEM_TYPES.PROJECT,
		images,
	};
}

export interface GetAllProjectsOptions {
	search?: string;
	limit?: number;
	offset?: number;
}

// Fetch a project by ID with owner information
export async function getProjectById(id: string): Promise<ProjectItem | null> {
	const project = await prisma.project.findUnique({
		where: { id },
		select: projectWithOwnerFields,
	});
	if (!project) return null;
	
	const images = await getImagesForTarget("PROJECT", id);
	return toProjectItem(project, images);
}

// Fetch all projects with optional basic text search and pagination
// Search matches title or description (case-insensitive partial match)
export async function getAllProjects(search?: string, options?: GetAllProjectsOptions): Promise<ProjectItem[]> {
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
		...(options?.offset !== undefined ? { skip: options.offset } : {}),
		...(options?.limit !== undefined ? { take: options.limit } : {}),
	});
	
	// Batch load images for all projects (fixes N+1 query problem)
	const projectIds = projects.map(p => p.id);
	const imagesMap = await getImagesForTargetsBatch("PROJECT", projectIds);
	
	return projects.map((p) => toProjectItem(p, imagesMap.get(p.id) || []));
}

// Fetch all projects by a specific owner
export async function getProjectsByOwner(ownerId: string): Promise<ProjectItem[]> {
	const projects = await prisma.project.findMany({
		where: { ownerId },
		select: projectWithOwnerFields,
		orderBy: { createdAt: "desc" },
	});
	
	// Batch load images for all projects (fixes N+1 query problem)
	const projectIds = projects.map(p => p.id);
	const imagesMap = await getImagesForTargetsBatch("PROJECT", projectIds);
	
	return projects.map((p) => toProjectItem(p, imagesMap.get(p.id) || []));
}

// Fetch all projects by a specific user (via their personal owner)
export async function getProjectsByUser(userId: string): Promise<ProjectItem[]> {
	// Find user's personal owner
	const personalOwner = await prisma.owner.findFirst({
		where: { userId, orgId: null },
		select: { id: true },
	});
	if (!personalOwner) return [];
	return getProjectsByOwner(personalOwner.id);
}

// Create a new project for an owner
// Tags are optional - if not provided or empty, defaults appropriately
// Images should be uploaded separately and linked to the project via ImageAttachment
export async function createProject(ownerId: string, data: ProjectData): Promise<ProjectItem> {
	const project = await prisma.project.create({
		data: {
			title: data.title,
			description: data.description,
			tags: data.tags || [],
			ownerId,
		},
		select: projectWithOwnerFields,
	});
	
	// New project has no images yet
	return toProjectItem(project, []);
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
		const images = await getImagesForTarget("PROJECT", project.id);
		return toProjectItem(project, images);
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
