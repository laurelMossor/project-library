import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { validateProjectUpdateData } from "@/lib/validations";
import { projectWithOwnerFields } from "@/lib/utils/server/fields";
import { getImagesForTarget } from "@/lib/utils/server/image-attachment";
import { COLLECTION_TYPES } from "@/lib/types/collection";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/:id
 * Get a project by ID
 * Public endpoint
 */
export async function GET(request: Request, { params }: Params) {
	try {
		const { id } = await params;

		const project = await prisma.project.findUnique({
			where: { id },
			select: projectWithOwnerFields,
		});

		if (!project) {
			return notFound("Project not found");
		}

		// Load images
		const images = await getImagesForTarget("PROJECT", id);

		const projectItem = {
			...project,
			type: COLLECTION_TYPES.PROJECT,
			images,
		};

		return NextResponse.json(projectItem);
	} catch (error) {
		console.error("GET /api/projects/:id error:", error);
		return serverError("Failed to fetch project");
	}
}

/**
 * PATCH /api/projects/:id
 * Update a project (must be owner)
 */
export async function PATCH(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { id } = await params;

		// Verify project exists and belongs to active owner
		const existing = await prisma.project.findUnique({
			where: { id },
			select: { ownerId: true },
		});

		if (!existing) {
			return notFound("Project not found");
		}

		if (existing.ownerId !== ctx.activeOwnerId) {
			return NextResponse.json(
				{ error: "You can only edit your own projects" },
				{ status: 403 }
			);
		}

		const data = await request.json();
		const { title, description, tags, topics } = data;

		// Process tags if provided
		let processedTags: string[] | undefined;
		if (tags !== undefined) {
			if (typeof tags === "string") {
				processedTags = tags
					.split(",")
					.map((tag) => tag.trim())
					.filter(Boolean);
			} else if (Array.isArray(tags)) {
				processedTags = tags
					.map((tag) => (typeof tag === "string" ? tag.trim() : String(tag).trim()))
					.filter(Boolean);
			}
		}

		// Validate update data
		const validation = validateProjectUpdateData({
			title,
			description,
			tags: processedTags,
		});
		if (!validation.valid) {
			return badRequest(validation.error || "Invalid project data");
		}

		const updateData: Record<string, unknown> = {};
		if (title !== undefined) updateData.title = title.trim();
		if (description !== undefined) updateData.description = description.trim();
		if (processedTags !== undefined) updateData.tags = processedTags;
		if (topics !== undefined) updateData.topics = Array.isArray(topics) ? topics : [];

		const project = await prisma.project.update({
			where: { id },
			data: updateData,
			select: projectWithOwnerFields,
		});

		// Load images
		const images = await getImagesForTarget("PROJECT", id);

		const projectItem = {
			...project,
			type: COLLECTION_TYPES.PROJECT,
			images,
		};

		return NextResponse.json(projectItem);
	} catch (error) {
		console.error("PATCH /api/projects/:id error:", error);
		return serverError("Failed to update project");
	}
}

/**
 * DELETE /api/projects/:id
 * Delete a project (must be owner)
 */
export async function DELETE(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { id } = await params;

		// Verify project exists and belongs to active owner
		const existing = await prisma.project.findUnique({
			where: { id },
			select: { ownerId: true },
		});

		if (!existing) {
			return notFound("Project not found");
		}

		if (existing.ownerId !== ctx.activeOwnerId) {
			return NextResponse.json(
				{ error: "You can only delete your own projects" },
				{ status: 403 }
			);
		}

		await prisma.project.delete({ where: { id } });

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("DELETE /api/projects/:id error:", error);
		return serverError("Failed to delete project");
	}
}
