import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAllProjects, createProject } from "@/lib/utils/project";
import { unauthorized, badRequest } from "@/lib/utils/errors";
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
		console.error("Error fetching projects:", error);
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
	const { title, description, tags, imageUrl } = data;

	try {
		// Process tags first: normalize to array, trim, and filter empty values
		// Handles both comma-separated string and array inputs
		let processedTags: string[] = [];
		if (tags) {
			if (typeof tags === "string") {
				processedTags = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
			} else if (Array.isArray(tags)) {
				processedTags = tags.map((tag) => (typeof tag === "string" ? tag.trim() : String(tag).trim())).filter(Boolean);
			}
		}

		// Validate project data with processed tags and imageUrl (or undefined if not provided)
		const validation = validateProjectData({
			title,
			description,
			tags: processedTags.length > 0 ? processedTags : undefined,
			imageUrl: imageUrl || undefined,
		});
		if (!validation.valid) {
			return badRequest(validation.error || "Invalid project data");
		}

		const project = await createProject(session.user.id, {
			title: title.trim(),
			description: description.trim(),
			tags: processedTags.length > 0 ? processedTags : undefined,
			imageUrl: imageUrl || undefined,
		});

		return NextResponse.json(project, { status: 201 });
	} catch (error) {
		console.error("Error creating project:", error);
		return badRequest("Failed to create project");
	}
}

