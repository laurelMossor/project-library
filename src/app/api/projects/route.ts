import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, serverError } from "@/lib/utils/errors";
import { validateProjectData } from "@/lib/validations";
import { checkRateLimit, getClientIdentifier } from "@/lib/utils/server/rate-limit";
import { projectWithOwnerFields } from "@/lib/utils/server/fields";
import { getImagesForTargetsBatch } from "@/lib/utils/server/image-attachment";
import { COLLECTION_TYPES } from "@/lib/types/collection";

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

/**
 * GET /api/projects
 * List projects with optional search/pagination
 * Public endpoint (no auth required)
 */
export async function GET(request: Request) {
	// Rate limiting: 60 requests per minute per IP
	const clientId = getClientIdentifier(request);
	const rateLimit = checkRateLimit(`search-projects:${clientId}`, {
		maxRequests: 60,
		windowMs: 60 * 1000,
	});

	if (!rateLimit.allowed) {
		return NextResponse.json(
			{ error: "Too many requests. Please try again later." },
			{ status: 429 }
		);
	}

	const { searchParams } = new URL(request.url);
	const search = searchParams.get("search") || undefined;
	const ownerId = searchParams.get("ownerId") || undefined;
	const orgId = searchParams.get("orgId") || undefined;
	const userId = searchParams.get("userId") || undefined;
	const limit = parseNumber(searchParams.get("limit"));
	const offset = parseNumber(searchParams.get("offset"));

	// Enforce max limit (100 items per request)
	const MAX_LIMIT = 100;
	const enforcedLimit =
		typeof limit === "number" && limit > 0 ? Math.min(limit, MAX_LIMIT) : 50;

	try {
		const projects = await prisma.project.findMany({
			where: {
				...(search
					? {
							OR: [
								{ title: { contains: search, mode: "insensitive" } },
								{ description: { contains: search, mode: "insensitive" } },
							],
					  }
					: {}),
				...(ownerId ? { ownerId } : {}),
				...(orgId ? { owner: { orgId } } : {}),
				...(userId ? { owner: { userId } } : {}),
			},
			select: projectWithOwnerFields,
			orderBy: { createdAt: "desc" },
			take: enforcedLimit,
			...(typeof offset === "number" && offset >= 0 ? { skip: offset } : {}),
		});

		// Batch load images
		const projectIds = projects.map((p) => p.id);
		const imagesMap = await getImagesForTargetsBatch("PROJECT", projectIds);

		// Transform to include type and images
		const projectsWithImages = projects.map((p) => ({
			...p,
			type: COLLECTION_TYPES.PROJECT,
			images: imagesMap.get(p.id) || [],
		}));

		return NextResponse.json(projectsWithImages);
	} catch (error) {
		console.error("GET /api/projects error:", error);
		return serverError("Failed to fetch projects");
	}
}

/**
 * POST /api/projects
 * Create a new project
 * Protected endpoint (requires authentication)
 */
export async function POST(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const data = await request.json();
		const { title, description, tags, topics } = data;

		// Process tags: normalize to array, trim, and filter empty values
		let processedTags: string[] = [];
		if (tags) {
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

		// Validate project data
		const validation = validateProjectData({
			title,
			description,
			tags: processedTags.length > 0 ? processedTags : undefined,
		});
		if (!validation.valid) {
			return badRequest(validation.error || "Invalid project data");
		}

		const project = await prisma.project.create({
			data: {
				ownerId: ctx.activeOwnerId,
				title: title.trim(),
				description: description.trim(),
				tags: processedTags,
				topics: Array.isArray(topics) ? topics : [],
			},
			select: projectWithOwnerFields,
		});

		// Return with type and empty images (new project has no images yet)
		const projectItem = {
			...project,
			type: COLLECTION_TYPES.PROJECT,
			images: [],
		};

		return NextResponse.json(projectItem, { status: 201 });
	} catch (error) {
		console.error("POST /api/projects error:", error);
		return serverError("Failed to create project");
	}
}
