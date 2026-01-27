import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { success, unauthorized, forbidden, notFound, serverError } from "@/lib/utils/server/api-response";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/events/:id
 * Get an event by ID
 */
export async function GET(request: Request, { params }: Params) {
	try {
		const { id } = await params;

		const event = await prisma.event.findUnique({
			where: { id },
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
								firstName: true,
								lastName: true,
								avatarImageId: true,
							},
						},
						org: {
							select: {
								id: true,
								slug: true,
								name: true,
								avatarImageId: true,
							},
						},
					},
				},
				posts: {
					orderBy: { createdAt: "desc" },
					take: 10,
					select: {
						id: true,
						title: true,
						content: true,
						createdAt: true,
					},
				},
			},
		});

		if (!event) {
			return notFound("Event not found");
		}

		return success({
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
				owner: {
					id: event.owner.id,
					type: event.owner.type,
					user: event.owner.user,
					org: event.owner.org,
				},
				posts: event.posts,
			},
		});
	} catch (error) {
		console.error("GET /api/events/:id error:", error);
		return serverError();
	}
}

/**
 * PATCH /api/events/:id
 * Update an event (must be owner)
 * 
 * Body: { title?: string, description?: string, eventDateTime?: string, location?: string, latitude?: number, longitude?: number, tags?: string[], topics?: string[] }
 */
export async function PATCH(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { id } = await params;
		const body = await request.json();

		// Verify event exists and belongs to active owner
		const event = await prisma.event.findUnique({ where: { id } });
		if (!event) {
			return notFound("Event not found");
		}

		if (event.ownerId !== ctx.activeOwnerId) {
			return forbidden("You can only edit your own events");
		}

		const { title, description, eventDateTime, location, latitude, longitude, tags, topics } = body;

		const updateData: Record<string, unknown> = {};
		if (title !== undefined) updateData.title = title.trim();
		if (description !== undefined) updateData.description = description.trim();
		if (eventDateTime !== undefined) updateData.eventDateTime = new Date(eventDateTime);
		if (location !== undefined) updateData.location = location.trim();
		if (latitude !== undefined) updateData.latitude = latitude;
		if (longitude !== undefined) updateData.longitude = longitude;
		if (tags !== undefined) updateData.tags = tags;
		if (topics !== undefined) updateData.topics = topics;

		const updated = await prisma.event.update({
			where: { id },
			data: updateData,
		});

		return success({
			event: {
				id: updated.id,
				ownerId: updated.ownerId,
				title: updated.title,
				description: updated.description,
				eventDateTime: updated.eventDateTime,
				location: updated.location,
				latitude: updated.latitude,
				longitude: updated.longitude,
				tags: updated.tags,
				topics: updated.topics,
				createdAt: updated.createdAt,
				updatedAt: updated.updatedAt,
			},
		});
	} catch (error) {
		console.error("PATCH /api/events/:id error:", error);
		return serverError();
	}
}

/**
 * DELETE /api/events/:id
 * Delete an event (must be owner)
 */
export async function DELETE(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { id } = await params;

		// Verify event exists and belongs to active owner
		const event = await prisma.event.findUnique({ where: { id } });
		if (!event) {
			return notFound("Event not found");
		}

		if (event.ownerId !== ctx.activeOwnerId) {
			return forbidden("You can only delete your own events");
		}

		await prisma.event.delete({ where: { id } });

		return success({ deleted: true });
	} catch (error) {
		console.error("DELETE /api/events/:id error:", error);
		return serverError();
	}
}
