import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, serverError } from "@/lib/utils/errors";
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

// Post content validation
function validatePostContent(content: string): { valid: boolean; error?: string } {
	if (!content || typeof content !== "string") {
		return { valid: false, error: "Post content is required" };
	}
	if (content.trim().length === 0) {
		return { valid: false, error: "Post content cannot be empty" };
	}
	if (content.length > 10000) {
		return { valid: false, error: "Post content must be 10000 characters or less" };
	}
	return { valid: true };
}

function validatePostTitle(title: string | undefined): { valid: boolean; error?: string } {
	if (title !== undefined && title !== null) {
		if (typeof title !== "string") {
			return { valid: false, error: "Post title must be a string" };
		}
		if (title.length > 200) {
			return { valid: false, error: "Post title must be 200 characters or less" };
		}
	}
	return { valid: true };
}

const postWithOwnerFields = {
	id: true,
	ownerId: true,
	projectId: true,
	eventId: true,
	title: true,
	content: true,
	tags: true,
	topics: true,
	createdAt: true,
	updatedAt: true,
	owner: {
		select: {
			id: true,
			type: true,
			user: {
				select: {
					id: true,
					username: true,
					displayName: true,
					firstName: true,
					lastName: true,
					avatarImageId: true,
				},
			},
			org: {
				select: {
					id: true,
					name: true,
					slug: true,
					avatarImageId: true,
				},
			},
		},
	},
};

/**
 * GET /api/posts
 * List posts with optional filters
 * Public endpoint
 */
export async function GET(request: Request) {
	// Rate limiting: 60 requests per minute per IP
	const clientId = getClientIdentifier(request);
	const rateLimit = checkRateLimit(`search-posts:${clientId}`, {
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
	const ownerId = searchParams.get("ownerId") || undefined;
	const projectId = searchParams.get("projectId") || undefined;
	const eventId = searchParams.get("eventId") || undefined;
	const limit = parseNumber(searchParams.get("limit"));
	const offset = parseNumber(searchParams.get("offset"));

	// Enforce max limit (100 items per request)
	const MAX_LIMIT = 100;
	const enforcedLimit =
		typeof limit === "number" && limit > 0 ? Math.min(limit, MAX_LIMIT) : 50;

	try {
		const posts = await prisma.post.findMany({
			where: {
				...(ownerId ? { ownerId } : {}),
				...(projectId ? { projectId } : {}),
				...(eventId ? { eventId } : {}),
			},
			select: postWithOwnerFields,
			orderBy: { createdAt: "desc" },
			take: enforcedLimit,
			...(typeof offset === "number" && offset >= 0 ? { skip: offset } : {}),
		});

		return NextResponse.json(posts);
	} catch (error) {
		console.error("GET /api/posts error:", error);
		return serverError("Failed to fetch posts");
	}
}

/**
 * POST /api/posts
 * Create a new post
 * Protected endpoint (requires authentication)
 * 
 * Body: { content: string, title?: string, projectId?: string, eventId?: string, tags?: string[], topics?: string[] }
 * Rule: at most one of projectId, eventId
 */
export async function POST(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const data = await request.json();
		const { content, title, projectId, eventId, tags, topics } = data;

		// Validate content
		const contentValidation = validatePostContent(content);
		if (!contentValidation.valid) {
			return badRequest(contentValidation.error || "Invalid post content");
		}

		// Validate title if provided
		const titleValidation = validatePostTitle(title);
		if (!titleValidation.valid) {
			return badRequest(titleValidation.error || "Invalid post title");
		}

		// Validate at most one parent
		if (projectId && eventId) {
			return badRequest("Post can belong to at most one of projectId or eventId");
		}

		// Verify parent exists and belongs to user if provided
		if (projectId) {
			const project = await prisma.project.findUnique({
				where: { id: projectId },
				select: { ownerId: true },
			});
			if (!project) {
				return badRequest("Project not found");
			}
			if (project.ownerId !== ctx.activeOwnerId) {
				return badRequest("Cannot create post for a project you don't own");
			}
		}

		if (eventId) {
			const event = await prisma.event.findUnique({
				where: { id: eventId },
				select: { ownerId: true },
			});
			if (!event) {
				return badRequest("Event not found");
			}
			if (event.ownerId !== ctx.activeOwnerId) {
				return badRequest("Cannot create post for an event you don't own");
			}
		}

		// Process tags
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

		const post = await prisma.post.create({
			data: {
				ownerId: ctx.activeOwnerId,
				content: content.trim(),
				title: title?.trim() || null,
				projectId: projectId || null,
				eventId: eventId || null,
				tags: processedTags,
				topics: Array.isArray(topics) ? topics : [],
			},
			select: postWithOwnerFields,
		});

		return NextResponse.json(post, { status: 201 });
	} catch (error) {
		console.error("POST /api/posts error:", error);
		return serverError("Failed to create post");
	}
}
