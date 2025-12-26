import { prisma } from "./prisma";
import { ProjectData, Project } from "../types/project";
import { publicUserFields } from "./user";

// Standard fields to select when fetching a project with owner info
const projectWithOwnerFields = {
	id: true,
	type: true,
	title: true,
	description: true,
	tags: true,
	imageUrl: true,
	createdAt: true,
	updatedAt: true,
	owner: {
		select: publicUserFields,
	},
} as const;

// Fetch a project by ID with owner information
export async function getProjectById(id: string): Promise<Project | null> {
	return prisma.project.findUnique({
		where: { id },
		select: projectWithOwnerFields,
	});
}

// Fetch all projects with optional basic text search
// Search matches title or description (case-insensitive partial match)
export async function getAllProjects(search?: string): Promise<Project[]> {
	const where = search
		? {
				OR: [
					{ title: { contains: search, mode: "insensitive" as const } },
					{ description: { contains: search, mode: "insensitive" as const } },
				],
			}
		: {};

	return prisma.project.findMany({
		where,
		select: projectWithOwnerFields,
		orderBy: { createdAt: "desc" }, // Most recent first
	});
}

// Fetch all projects by a specific user
export async function getProjectsByUser(userId: string): Promise<Project[]> {
	return prisma.project.findMany({
		where: { ownerId: userId },
		select: projectWithOwnerFields,
		orderBy: { createdAt: "desc" },
	});
}

// Create a new project for a user
// Tags and imageUrl are optional - if not provided or empty, defaults appropriately
export async function createProject(ownerId: string, data: ProjectData): Promise<Project> {
	return prisma.project.create({
		data: {
			title: data.title,
			description: data.description,
			tags: data.tags || [],
			imageUrl: data.imageUrl || null,
			ownerId,
		},
		select: projectWithOwnerFields,
	});
}


