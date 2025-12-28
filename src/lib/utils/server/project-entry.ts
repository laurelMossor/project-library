// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import type { ProjectEntryItem } from "@/lib/types/project";

// Fetch all entries for a project, sorted by createdAt (newest first)
export async function getProjectEntries(projectId: string): Promise<ProjectEntryItem[]> {
	const entries = await prisma.projectEntry.findMany({
		where: { projectId },
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			projectId: true,
			title: true,
			content: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	return entries.map((entry): ProjectEntryItem => ({
		id: entry.id,
		projectId: entry.projectId,
		title: entry.title,
		content: entry.content,
		createdAt: entry.createdAt,
		updatedAt: entry.updatedAt,
	}));
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

	const entry = await prisma.projectEntry.create({
		data: {
			projectId,
			title: data.title?.trim() || null,
			content: data.content.trim(),
		},
		select: {
			id: true,
			projectId: true,
			title: true,
			content: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	return {
		id: entry.id,
		projectId: entry.projectId,
		title: entry.title,
		content: entry.content,
		createdAt: entry.createdAt,
		updatedAt: entry.updatedAt,
	};
}

