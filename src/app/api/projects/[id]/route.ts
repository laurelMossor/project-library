import { NextResponse } from "next/server";
import { getProjectById } from "@/lib/project";
import { notFound } from "@/lib/errors";

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

