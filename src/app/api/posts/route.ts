import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, serverError } from "@/lib/utils/errors";
import { checkRateLimit, getClientIdentifier } from "@/lib/utils/server/rate-limit";
import { canPostAsPage } from "@/lib/utils/server/permission";
import { publicUserFields } from "@/lib/utils/server/user";
import { getImagesForTargetsBatch } from "@/lib/utils/server/image-attachment";
import { postCollectionFields } from "@/lib/utils/server/fields";
import { COLLECTION_TYPES } from "@/lib/types/collection";
import { logAction } from "@/lib/utils/server/log";

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

const postFields = {
	id: true,
	userId: true,
	pageId: true,
	eventId: true,
	parentPostId: true,
	title: true,
	content: true,
	tags: true,
	topics: true,
	createdAt: true,
	updatedAt: true,
	user: {
		select: publicUserFields,
	},
	page: {
		select: {
			id: true,
			name: true,
			slug: true,
			avatarImageId: true,
			avatarImage: { select: { url: true } },
		},
	},
	event: {
		select: {
			id: true,
			title: true,
		},
	},
	parentPost: {
		select: {
			id: true,
			title: true,
		},
	},
};

/**
 * GET /api/posts
 * List posts with optional filters
 * Public endpoint
 */
export async function GET(request: Request) {
	// Rate limiting: 200 requests per minute per IP
	// Higher limit because each collection card may fetch child posts individually
	const clientId = getClientIdentifier(request);
	const rateLimit = checkRateLimit(`search-posts:${clientId}`, {
		maxRequests: 200,
		windowMs: 60 * 1000,
	});

	if (!rateLimit.allowed) {
		return NextResponse.json(
			{ error: "Too many requests. Please try again later." },
			{ status: 429 }
		);
	}

	const { searchParams } = new URL(request.url);
	const userId = searchParams.get("userId") || undefined;
	const pageId = searchParams.get("pageId") || undefined;
	const eventId = searchParams.get("eventId") || undefined;
	const parentPostId = searchParams.get("parentPostId") || undefined;
	const toplevel = searchParams.get("toplevel"); // "true" to exclude child/event posts
	const limit = parseNumber(searchParams.get("limit"));
	const offset = parseNumber(searchParams.get("offset"));

	// Enforce max limit (100 items per request)
	const MAX_LIMIT = 100;
	const enforcedLimit =
		typeof limit === "number" && limit > 0 ? Math.min(limit, MAX_LIMIT) : 50;

	try {
		const posts = await prisma.post.findMany({
			where: {
				...(userId ? { userId } : {}),
				...(pageId ? { pageId } : {}),
				...(eventId ? { eventId } : {}),
				...(parentPostId ? { parentPostId } : {}),
				// When toplevel=true, only return posts without a parent or event
				...(toplevel === "true" ? { parentPostId: null, eventId: null } : {}),
			},
			select: postCollectionFields,
			orderBy: { createdAt: "desc" },
			take: enforcedLimit,
			...(typeof offset === "number" && offset >= 0 ? { skip: offset } : {}),
		});

		// Batch load images
		const postIds = posts.map((p) => p.id);
		const imagesMap = await getImagesForTargetsBatch("POST", postIds);

		// Transform to include type and images
		const postsWithImages = posts.map(({ _count, updates, ...p }) => ({
			...p,
			type: COLLECTION_TYPES.POST,
			images: imagesMap.get(p.id) || [],
			_count: { updates: _count.updates },
			recentUpdate: updates[0] || null,
		}));

		return NextResponse.json(postsWithImages);
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
 * Body: { content: string, title?: string, pageId?: string, eventId?: string, parentPostId?: string, tags?: string[], topics?: string[] }
 */
export async function POST(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const data = await request.json();
		const { content, title, pageId, eventId, parentPostId, tags, topics } = data;

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

		// If pageId provided, verify user has permission to post as this page
		if (pageId) {
			const allowed = await canPostAsPage(ctx.userId, pageId);
			if (!allowed) {
				return badRequest("You don't have permission to post as this page");
			}
		}

		// Verify event exists if provided
		if (eventId) {
			const event = await prisma.event.findUnique({
				where: { id: eventId },
				select: { userId: true },
			});
			if (!event) {
				return badRequest("Event not found");
			}
			if (event.userId !== ctx.userId) {
				return badRequest("Cannot create post for an event you don't own");
			}
		}

		// If parentPostId provided, verify parent exists and has no parent itself (one-level deep)
		if (parentPostId) {
			const parentPost = await prisma.post.findUnique({
				where: { id: parentPostId },
				select: { id: true, parentPostId: true },
			});
			if (!parentPost) {
				return badRequest("Parent post not found");
			}
			if (parentPost.parentPostId) {
				return badRequest("Cannot nest posts more than one level deep");
			}
		}

		// Process tags
		let processedTags: string[] = [];
		if (tags) {
			if (typeof tags === "string") {
				processedTags = tags
					.split(",")
					.map((tag: string) => tag.trim())
					.filter(Boolean);
			} else if (Array.isArray(tags)) {
				processedTags = tags
					.map((tag: unknown) => (typeof tag === "string" ? tag.trim() : String(tag).trim()))
					.filter(Boolean);
			}
		}

		const post = await prisma.post.create({
			data: {
				userId: ctx.userId,
				content: content.trim(),
				title: title?.trim() || null,
				pageId: pageId || null,
				eventId: eventId || null,
				parentPostId: parentPostId || null,
				tags: processedTags,
				topics: Array.isArray(topics) ? topics : [],
			},
			select: postFields,
		});

		logAction("post.created", ctx.userId, {
			postId: post.id,
			pageId: post.pageId ?? undefined,
			eventId: post.eventId ?? undefined,
			isReply: post.parentPostId != null,
		});

		return NextResponse.json(post, { status: 201 });
	} catch (error) {
		console.error("POST /api/posts error:", error);
		return serverError("Failed to create post");
	}
}
