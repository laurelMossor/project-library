import { prisma } from "./prisma";

export interface ProjectEntryItem {
	id: string;
	projectId: string;
	title: string | null;
	content: string;
	createdAt: Date;
	updatedAt: Date;
}

// Fetch all entries for a project, sorted by createdAt (newest first)
export async function getProjectEntries(projectId: string): Promise<ProjectEntryItem[]> {
	return prisma.projectEntry.findMany({
		where: { projectId },
		orderBy: { createdAt: "desc" },
	});
}

// Create a new entry for a project
export async function createProjectEntry(
	projectId: string,
	data: { title?: string; content: string }
): Promise<ProjectEntryItem> {
	// Validate content is not empty
	if (!data.content || data.content.trim().length === 0) {
		throw new Error("Content is required and cannot be empty");
	}

	// Verify project exists
	const project = await prisma.project.findUnique({
		where: { id: projectId },
	});

	if (!project) {
		throw new Error("Project not found");
	}

	return prisma.projectEntry.create({
		data: {
			projectId,
			title: data.title || null,
			content: data.content.trim(),
		},
	});
}

