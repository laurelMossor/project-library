import { prisma } from "./prisma";
import { ProjectData } from "./validations";

// Standard fields to select when fetching a project with owner info
const projectWithOwnerFields = {
	id: true,
	title: true,
	description: true,
	tags: true,
	createdAt: true,
	updatedAt: true,
	owner: {
		select: {
			id: true,
			username: true,
			name: true,
		},
	},
} as const;

// Fetch a project by ID with owner information
export async function getProjectById(id: string) {
	return prisma.project.findUnique({
		where: { id },
		select: projectWithOwnerFields,
	});
}

// Fetch all projects with optional basic text search
// Search matches title or description (case-insensitive partial match)
export async function getAllProjects(search?: string) {
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

// Create a new project for a user
export async function createProject(ownerId: string, data: ProjectData) {
	return prisma.project.create({
		data: {
			title: data.title,
			description: data.description,
			tags: data.tags || [],
			ownerId,
		},
		select: projectWithOwnerFields,
	});
}

