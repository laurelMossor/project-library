import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getViewerContext, postListWhere } from "@/lib/utils/server/visibility";
import { serverError } from "@/lib/utils/errors";
import { enforceRateLimit } from "@/lib/utils/server/rate-limit";
import { getImagesForTargetsBatch } from "@/lib/utils/server/image-attachment";
import { postCollectionFields, toCollectionMeta } from "@/lib/utils/server/fields";
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
 * GET /api/posts
 * List posts with optional filters
 * Public endpoint
 *
 * Creating a post is the `createDraftPostAction` Server Action (src/lib/actions/post.ts).
 */
export async function GET(request: Request) {
	// Rate limiting: 200 requests per minute per IP
	const limited = await enforceRateLimit(request, "search-posts", {
		maxRequests: 200,
		windowMs: 60 * 1000,
	});
	if (limited) return limited;

	const { searchParams } = new URL(request.url);
	const userId = searchParams.get("userId") || undefined;
	const pageId = searchParams.get("pageId") || undefined;
	const eventId = searchParams.get("eventId") || undefined;
	const toplevel = searchParams.get("toplevel"); // "true" to exclude child/event posts
	const search = searchParams.get("search") || undefined;
	const limit = parseNumber(searchParams.get("limit"));
	const offset = parseNumber(searchParams.get("offset"));

	// Enforce max limit (100 items per request)
	const MAX_LIMIT = 100;
	const enforcedLimit =
		typeof limit === "number" && limit > 0 ? Math.min(limit, MAX_LIMIT) : 50;

	const viewer = await getViewerContext();

	// Determine draft visibility:
	// - user querying their own posts: no status filter (see all own posts)
	// - logged-in user querying anything else: see published + own drafts
	// - anonymous: published only
	const isOwnUserQuery = !!(viewer.userId && userId && userId === viewer.userId);

	// Collect all AND conditions to avoid multiple OR keys clobbering each other.
	const andConditions: object[] = [];

	// Non-own queries always see published only — drafts are only visible on your own profile page
	if (!isOwnUserQuery) {
		andConditions.push({ status: "PUBLISHED" as const });
	}

	// List mode is the public feed: LISTED only, for every viewer.
	andConditions.push(postListWhere());

	if (search) {
		andConditions.push({ OR: [
			{ title: { contains: search, mode: "insensitive" as const } },
			{ content: { contains: search, mode: "insensitive" as const } },
		]});
	}

	try {
		const posts = await prisma.post.findMany({
			where: {
				...(userId ? { userId } : {}),
				...(pageId ? { pageId } : {}),
				...(eventId ? { eventId } : {}),
				// When toplevel=true, only return posts without a parent or event
				...(toplevel === "true" ? { parentPostId: null, eventId: null } : {}),
				...(andConditions.length > 0 ? { AND: andConditions } : {}),
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
			...toCollectionMeta({ _count, updates }),
		}));

		return NextResponse.json(postsWithImages);
	} catch (error) {
		console.error("GET /api/posts error:", error);
		return serverError("Failed to fetch posts");
	}
}
