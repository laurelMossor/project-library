import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, serverError } from "@/lib/utils/errors";
import { validateEventData } from "@/lib/validations";
import { checkRateLimit, getClientIdentifier } from "@/lib/utils/server/rate-limit";
import { eventWithUserFields, eventCollectionFields } from "@/lib/utils/server/fields";
import { getImagesForTargetsBatch } from "@/lib/utils/server/image-attachment";
import { COLLECTION_TYPES } from "@/lib/types/collection";
import { canPostAsPage } from "@/lib/utils/server/permission";

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
 */
export async function GET(request: Request) {
	// Rate limiting: 60 requests per minute per IP
	const clientId = getClientIdentifier(request);
	const rateLimit = checkRateLimit(`search-events:${clientId}`, {
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
	const userId = searchParams.get("userId") || undefined;
	const pageId = searchParams.get("pageId") || undefined;
	const limit = parseNumber(searchParams.get("limit"));
	const offset = parseNumber(searchParams.get("offset"));

	// Enforce max limit (100 items per request)
	const MAX_LIMIT = 100;
	const enforcedLimit =
		typeof limit === "number" && limit > 0 ? Math.min(limit, MAX_LIMIT) : 50;

	try {
		// Only show published events in public listings
		const events = await prisma.event.findMany({
			where: {
				status: "PUBLISHED",
				...(search
					? {
							OR: [
								{ title: { contains: search, mode: "insensitive" } },
								{ content: { contains: search, mode: "insensitive" } },
							],
					  }
					: {}),
				...(userId ? { userId } : {}),
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
			_count: { updates: _count.updates },
			recentUpdate: updates[0] || null,
		}));

		return NextResponse.json(eventsWithImages);
	} catch (error) {
		console.error("GET /api/events error:", error);
		return serverError("Failed to fetch events");
	}
}

/**
 * POST /api/events
 * Create a new event
 * Protected endpoint (requires authentication)
 */
export async function POST(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const data = await request.json();
		const { title, content, eventDateTime, location, latitude, longitude, tags, topics, isDraft, pageId } = data;

		// If posting as a page, verify permission
		if (pageId) {
			const allowed = await canPostAsPage(ctx.userId, pageId);
			if (!allowed) {
				return badRequest("You don't have permission to create events for this page");
			}
		}

		// Draft creation: minimal validation, used by inline editing flow
		if (isDraft) {
			const parsedDateTime = eventDateTime ? new Date(eventDateTime) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

			const event = await prisma.event.create({
				data: {
					userId: ctx.userId,
					...(pageId ? { pageId } : {}),
					title: (title || "").trim(),
					content: (content || "").trim(),
					eventDateTime: parsedDateTime,
					location: (location || "").trim(),
					status: "DRAFT",
					tags: [],
					topics: [],
				},
				select: eventWithUserFields,
			});

			const eventItem = {
				...event,
				type: COLLECTION_TYPES.EVENT,
				images: [],
			};

			return NextResponse.json(eventItem, { status: 201 });
		}

		// Standard creation: full validation
		const parsedDateTime = eventDateTime ? new Date(eventDateTime) : null;

		if (!parsedDateTime || isNaN(parsedDateTime.getTime())) {
			return badRequest("Event date is required and must be valid");
		}

		const parsedLatitude = parseNumber(latitude);
		const parsedLongitude = parseNumber(longitude);

		// Process tags
		let processedTags: string[] | undefined;
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

		// Validate event data
		const validation = validateEventData({
			title,
			content,
			eventDateTime: parsedDateTime,
			location,
			latitude: parsedLatitude ?? undefined,
			longitude: parsedLongitude ?? undefined,
			tags: processedTags,
		});
		if (!validation.valid) {
			return badRequest(validation.error || "Invalid event data");
		}

		const event = await prisma.event.create({
			data: {
				userId: ctx.userId,
				...(pageId ? { pageId } : {}),
				title: title.trim(),
				content: content.trim(),
				eventDateTime: parsedDateTime,
				location: location.trim(),
				latitude: parsedLatitude,
				longitude: parsedLongitude,
				tags: processedTags || [],
				topics: Array.isArray(topics) ? topics : [],
				status: "PUBLISHED",
			},
			select: eventWithUserFields,
		});

		// Return with type and empty images (new event has no images yet)
		const eventItem = {
			...event,
			type: COLLECTION_TYPES.EVENT,
			images: [],
		};

		return NextResponse.json(eventItem, { status: 201 });
	} catch (error) {
		console.error("POST /api/events error:", error);
		return serverError("Failed to create event");
	}
}
