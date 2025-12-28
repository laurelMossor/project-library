import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProjectById } from "@/lib/utils/server/project";
import { getProjectEntries, createProjectEntry } from "@/lib/utils/server/project-entry";
import { unauthorized, notFound, badRequest, serverError } from "@/lib/utils/errors";
import { prisma } from "@/lib/utils/server/prisma";

// GET /api/projects/[id]/entries - Get all entries for a project
// Public endpoint (anyone can view project entries)
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;

	try {
		// Verify project exists
		const project = await getProjectById(id);
		if (!project) {
			return notFound("Project not found");
		}

		const entries = await getProjectEntries(id);
		return NextResponse.json(entries);
	} catch (error) {
		console.error("Error fetching project entries:", error);
		return serverError("Failed to fetch project entries");
	}
}

// POST /api/projects/[id]/entries - Create a new entry for a project
// Protected endpoint (requires authentication, only project owner can create entries)
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const { id } = await params;

	try {
		// Verify project exists and user owns it
		const project = await prisma.project.findUnique({
			where: { id },
			select: { id: true, ownerId: true },
		});

		if (!project) {
			return notFound("Project not found");
		}

		if (project.ownerId !== session.user.id) {
			return NextResponse.json(
				{ error: "Only the project owner can create entries" },
				{ status: 403 }
			);
		}

		const data = await request.json();
		const { title, content } = data;

		// Validate content is provided
		if (!content || typeof content !== "string" || content.trim().length === 0) {
			return badRequest("Content is required and cannot be empty");
		}

		// Validate title if provided
		if (title !== undefined && title !== null && typeof title !== "string") {
			return badRequest("Title must be a string");
		}

		const entry = await createProjectEntry(id, {
			title: title?.trim() || undefined,
			content: content.trim(),
		});

		return NextResponse.json(entry, { status: 201 });
	} catch (error) {
		console.error("Error creating project entry:", error);
		if (error instanceof Error && error.message === "Project not found") {
			return notFound(error.message);
		}
		return serverError("Failed to create project entry");
	}
}

