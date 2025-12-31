// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import { ProjectData, ProjectItem, ProjectUpdateInput } from "../../types/project";
import { projectWithOwnerFields } from "./fields";
import { deleteImage } from "./storage";

// Fetch a project by ID with owner information
export async function getProjectById(id: string): Promise<ProjectItem | null> {
	const project = await prisma.project.findUnique({
		where: { id },
		select: projectWithOwnerFields,
	});
	if (!project) return null;
	return project as ProjectItem;
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
	return projects as ProjectItem[];
}

// Fetch all projects by a specific user
export async function getProjectsByUser(userId: string): Promise<ProjectItem[]> {
	const projects = await prisma.project.findMany({
		where: { ownerId: userId },
		select: projectWithOwnerFields,
		orderBy: { createdAt: "desc" },
	});
	return projects as ProjectItem[];
}

// Create a new project for a user
// Tags are optional - if not provided or empty, defaults appropriately
// Images should be uploaded separately and linked to the project
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
	return project as ProjectItem;
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
		return project as ProjectItem;
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
	// Fetch project with images before deleting to get image URLs
	const project = await prisma.project.findUnique({
		where: { id },
		select: projectWithOwnerFields,
	});

	if (!project) {
		throw new Error("Project not found");
	}

	// Delete all associated images from storage bucket
	if (project.images && project.images.length > 0) {
		for (const image of project.images) {
			if (image.url) {
				const result = await deleteImage(image.url);
				if (!result.success) {
					console.error(`Failed to delete image ${image.id} from storage:`, result.error);
					// Continue deleting other images even if one fails
				}
			}
		}
	}

	// Delete the project (cascade will delete image records from database)
	await prisma.project.delete({
		where: { id },
	});
}


