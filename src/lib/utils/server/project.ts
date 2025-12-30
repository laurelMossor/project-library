// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import { ProjectData, ProjectItem } from "../../types/project";
import { projectWithOwnerFields } from "./fields";

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


