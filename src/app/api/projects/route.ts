import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAllProjects, createProject } from "@/lib/project";
import { unauthorized, badRequest } from "@/lib/errors";
import { validateProjectData } from "@/lib/validations";

// GET /api/projects - Get all projects with optional search
// Public endpoint (no auth required)
export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const search = searchParams.get("search") || undefined;

	try {
		const projects = await getAllProjects(search);
		return NextResponse.json(projects);
	} catch (error) {
		return badRequest("Failed to fetch projects");
	}
}

// POST /api/projects - Create a new project
// Protected endpoint (requires authentication)
export async function POST(request: Request) {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const data = await request.json();
	const { title, description, tags } = data;

	// Validate project data
	const validation = validateProjectData({ title, description, tags });
	if (!validation.valid) {
		return badRequest(validation.error || "Invalid project data");
	}

	try {
		// Process tags: split comma-separated string if needed, trim, and filter empty
		let processedTags: string[] = [];
		if (tags) {
			if (typeof tags === "string") {
				processedTags = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
			} else if (Array.isArray(tags)) {
				processedTags = tags.map((tag) => (typeof tag === "string" ? tag.trim() : String(tag).trim())).filter(Boolean);
			}
		}

		const project = await createProject(session.user.id, {
			title: title.trim(),
			description: description.trim(),
			tags: processedTags,
		});

		return NextResponse.json(project, { status: 201 });
	} catch (error) {
		return badRequest("Failed to create project");
	}
}

