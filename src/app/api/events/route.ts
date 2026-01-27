import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { success, unauthorized, badRequest, serverError } from "@/lib/utils/server/api-response";

/**
 * POST /api/events
 * Create an event attributed to activeOwnerId
 * 
 * Body: { title: string, description: string, eventDateTime: string, location: string, latitude?: number, longitude?: number, tags?: string[], topics?: string[] }
 */
export async function POST(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const body = await request.json();
		const { title, description, eventDateTime, location, latitude, longitude, tags, topics } = body;

		if (!title || typeof title !== "string" || title.trim().length === 0) {
			return badRequest("title is required");
		}

		if (!description || typeof description !== "string") {
			return badRequest("description is required");
		}

		if (!eventDateTime) {
			return badRequest("eventDateTime is required");
		}

		if (!location || typeof location !== "string") {
			return badRequest("location is required");
		}

		const parsedDateTime = new Date(eventDateTime);
		if (isNaN(parsedDateTime.getTime())) {
			return badRequest("eventDateTime must be a valid date");
		}

		const event = await prisma.event.create({
			data: {
				ownerId: ctx.activeOwnerId,
				title: title.trim(),
				description: description.trim(),
				eventDateTime: parsedDateTime,
				location: location.trim(),
				latitude: latitude ?? null,
				longitude: longitude ?? null,
				tags: Array.isArray(tags) ? tags : [],
				topics: Array.isArray(topics) ? topics : [],
			},
		});

		return success(
			{
				event: {
					id: event.id,
					ownerId: event.ownerId,
					title: event.title,
					description: event.description,
					eventDateTime: event.eventDateTime,
					location: event.location,
					latitude: event.latitude,
					longitude: event.longitude,
					tags: event.tags,
					topics: event.topics,
					createdAt: event.createdAt,
					updatedAt: event.updatedAt,
				},
			},
			201
		);
	} catch (error) {
		console.error("POST /api/events error:", error);
		return serverError();
	}
}

/**
 * GET /api/events
 * List events with optional filters
 * 
 * Query: ?ownerId=...&orgId=...&userId=...
 */
export async function GET(request: Request) {
	try {
		const url = new URL(request.url);
		const ownerId = url.searchParams.get("ownerId");
		const orgId = url.searchParams.get("orgId");
		const userId = url.searchParams.get("userId");

		const events = await prisma.event.findMany({
			where: {
				...(ownerId ? { ownerId } : {}),
				...(orgId ? { owner: { orgId } } : {}),
				...(userId ? { owner: { userId } } : {}),
			},
			include: {
				owner: {
					select: {
						id: true,
						type: true,
						userId: true,
						orgId: true,
						user: {
							select: {
								id: true,
								username: true,
								displayName: true,
							},
						},
						org: {
							select: {
								id: true,
								slug: true,
								name: true,
							},
						},
					},
				},
			},
			orderBy: { eventDateTime: "asc" },
			take: 50,
		});

		return success({
			events: events.map((e) => ({
				id: e.id,
				ownerId: e.ownerId,
				title: e.title,
				description: e.description,
				eventDateTime: e.eventDateTime,
				location: e.location,
				latitude: e.latitude,
				longitude: e.longitude,
				tags: e.tags,
				topics: e.topics,
				createdAt: e.createdAt,
				updatedAt: e.updatedAt,
				owner: {
					id: e.owner.id,
					type: e.owner.type,
					user: e.owner.user
						? {
								id: e.owner.user.id,
								username: e.owner.user.username,
								displayName: e.owner.user.displayName,
						  }
						: null,
					org: e.owner.org
						? {
								id: e.owner.org.id,
								slug: e.owner.org.slug,
								name: e.owner.org.name,
						  }
						: null,
				},
			})),
		});
	} catch (error) {
		console.error("GET /api/events error:", error);
		return serverError();
	}
}
