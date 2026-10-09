import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { serverError } from "@/lib/utils/errors";
import { enforceRateLimit } from "@/lib/utils/server/rate-limit";
import { eventCollectionFields, toCollectionMeta } from "@/lib/utils/server/fields";
import { getImagesForTargetsBatch } from "@/lib/utils/server/image-attachment";
import { COLLECTION_TYPES } from "@/lib/types/collection";
import { eventListWhere } from "@/lib/utils/server/visibility";

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
 * GET /api/events
 * List events with optional search/pagination
 * Public endpoint (no auth required)
 *
 * Creating an event is the `createEventAction` Server Action (src/lib/actions/event.ts).
 */
export async function GET(request: Request) {
	// Rate limiting: 60 requests per minute per IP
	const limited = await enforceRateLimit(request, "search-events", {
		maxRequests: 60,
		windowMs: 60 * 1000,
	});
	if (limited) return limited;

	const { searchParams } = new URL(request.url);
	const search = searchParams.get("search") || undefined;
	const userId = searchParams.get("userId") || undefined;
	const pageId = searchParams.get("pageId") || undefined;
	const limit = parseNumber(searchParams.get("limit"));
	const offset = parseNumber(searchParams.get("offset"));

	// Enforce max limit (100 items per request)
	const MAX_LIMIT = 100;
	const enforcedLimit =
		typeof limit === "number" && limit > 0 ? Math.min(limit, MAX_LIMIT) : 50;

	try {
		// Public listings are LISTED only, for every viewer.
		const events = await prisma.event.findMany({
			where: {
				status: "PUBLISHED",
				AND: [
					eventListWhere(),
					...(search
						? [{
								OR: [
									{ title: { contains: search, mode: "insensitive" as const } },
									{ content: { contains: search, mode: "insensitive" as const } },
								],
						  }]
						: []),
				],
				...(userId ? { userId, pageId: null } : {}),
				...(pageId ? { pageId } : {}),
			},
			select: eventCollectionFields,
			orderBy: { eventDateTime: "asc" },
			take: enforcedLimit,
			...(typeof offset === "number" && offset >= 0 ? { skip: offset } : {}),
		});

		// Batch load images
		const eventIds = events.map((e) => e.id);
		const imagesMap = await getImagesForTargetsBatch("EVENT", eventIds);

		// Transform to include type and images
		const eventsWithImages = events.map(({ _count, updates, ...e }) => ({
			...e,
			type: COLLECTION_TYPES.EVENT,
			images: imagesMap.get(e.id) || [],
			...toCollectionMeta({ _count, updates }),
		}));

		return NextResponse.json(eventsWithImages);
	} catch (error) {
		console.error("GET /api/events error:", error);
		return serverError("Failed to fetch events");
	}
}
