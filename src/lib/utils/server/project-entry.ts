// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import type { ProjectEntryItem } from "../../types/project-entry";

// Fetch all entries for a project, sorted by createdAt (newest first)
export async function getProjectEntries(projectId: string) {
	return prisma.projectEntry.findMany({
		where: { projectId },
		orderBy: { createdAt: "desc" },
	});
}

// Create a new entry for a project
export async function createProjectEntry(
	projectId: string,
	data: { title?: string; content: string }
) {
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

