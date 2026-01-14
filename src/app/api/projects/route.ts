import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAllProjects, createProject } from "@/lib/utils/server/project";
import { unauthorized, badRequest } from "@/lib/utils/errors";
import { validateProjectData } from "@/lib/validations";
import { checkRateLimit, getClientIdentifier } from "@/lib/utils/server/rate-limit";

function parseNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

// GET /api/projects - Get all projects with optional search/pagination
// Public endpoint (no auth required)
export async function GET(request: Request) {
	// Rate limiting: 60 requests per minute per IP for search endpoints
	const clientId = getClientIdentifier(request);
	const rateLimit = checkRateLimit(`search-projects:${clientId}`, {
		maxRequests: 60,
		windowMs: 60 * 1000, // 1 minute
	});

	if (!rateLimit.allowed) {
		return NextResponse.json(
			{ error: "Too many requests. Please try again later." },
			{ status: 429 }
		);
	}

	const { searchParams } = new URL(request.url);
	const search = searchParams.get("search") || undefined;
	const limit = parseNumber(searchParams.get("limit"));
	const offset = parseNumber(searchParams.get("offset"));

	// Enforce max limit to prevent abuse (max 100 items per request)
	const MAX_LIMIT = 100;
	const enforcedLimit = typeof limit === "number" && limit > 0 
		? Math.min(limit, MAX_LIMIT) 
		: undefined;

	try {
		const projects = await getAllProjects(search, {
			limit: enforcedLimit,
			offset: typeof offset === "number" && offset >= 0 ? offset : undefined,
		});
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
	const { title, description, tags } = data;

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

		// Validate project data with processed tags
		// Note: Images should be uploaded separately and linked to the project after creation
		const validation = validateProjectData({
			title,
			description,
			tags: processedTags.length > 0 ? processedTags : undefined,
		});
		if (!validation.valid) {
			return badRequest(validation.error || "Invalid project data");
		}

		const project = await createProject(session.user.id, {
			title: title.trim(),
			description: description.trim(),
			tags: processedTags.length > 0 ? processedTags : undefined,
		});

		return NextResponse.json(project, { status: 201 });
	} catch (error) {
		console.error("Error creating project:", error);
		return badRequest("Failed to create project");
	}
}

