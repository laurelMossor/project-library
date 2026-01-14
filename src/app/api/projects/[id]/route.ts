import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProjectById, updateProject, deleteProject } from "@/lib/utils/server/project";
import { unauthorized, notFound, badRequest } from "@/lib/utils/errors";
import { validateProjectUpdateData } from "@/lib/validations";
import type { ProjectUpdateInput } from "@/lib/types/project";
import { getActorIdForUser, actorOwnsProject } from "@/lib/utils/server/actor";

// GET /api/projects/[id] - Get a single project by ID
// Public endpoint (no auth required)
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;

	try {
		const project = await getProjectById(id);

		if (!project) {
			return notFound("Project not found");
		}

		return NextResponse.json(project);
	} catch (error) {
		console.error("Error fetching project:", error);
		return notFound("Project not found");
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const project = await getProjectById(id);
	if (!project) {
		return notFound("Project not found");
	}

	// Check ownership via Actor
	const actorId = await getActorIdForUser(session.user.id);
	if (!actorId || !(await actorOwnsProject(actorId, id))) {
		return unauthorized("Only the owner can update this project");
	}

	const data = await request.json();

	const updatePayload: ProjectUpdateInput = {};

	if (data.title !== undefined) {
		if (typeof data.title !== "string") {
			return badRequest("Invalid title");
		}
		updatePayload.title = data.title.trim();
	}

	if (data.description !== undefined) {
		if (typeof data.description !== "string") {
			return badRequest("Invalid description");
		}
		updatePayload.description = data.description.trim();
	}

	if (data.tags !== undefined) {
		if (!Array.isArray(data.tags)) {
			return badRequest("Tags must be an array");
		}
		const tags = data.tags
			.map((tag: unknown) => (typeof tag === "string" ? tag.trim() : String(tag).trim()))
			.filter((tag: string) => tag.length > 0);
		updatePayload.tags = tags;
	}

	// Note: Images should be managed separately via image API endpoints

	if (Object.keys(updatePayload).length === 0) {
		return badRequest("No changes provided");
	}

	const validation = validateProjectUpdateData(updatePayload);

	if (!validation.valid) {
		return badRequest(validation.error || "Invalid project update data");
	}

	try {
		const updatedProject = await updateProject(id, updatePayload);
		return NextResponse.json(updatedProject);
	} catch (error) {
		console.error("Error updating project:", error);
		// Sanitize error message to prevent leaking internal details
		if (error instanceof Error && error.message.includes("not found")) {
			return notFound("Project not found");
		}
		return badRequest("Failed to update project");
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const project = await getProjectById(id);
	if (!project) {
		return notFound("Project not found");
	}

	// Check ownership via Actor
	const actorId = await getActorIdForUser(session.user.id);
	if (!actorId || !(await actorOwnsProject(actorId, id))) {
		return unauthorized("Only the owner can delete this project");
	}

	try {
		await deleteProject(id);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting project:", error);
		return badRequest("Failed to delete project");
	}
}

