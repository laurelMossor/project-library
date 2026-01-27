import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { success, unauthorized, badRequest, serverError } from "@/lib/utils/server/api-response";

/**
 * POST /api/posts
 * Create a post attributed to activeOwnerId
 * 
 * Body: { content: string, title?: string, projectId?: string, eventId?: string, tags?: string[], topics?: string[] }
 * 
 * Rule: at most one of projectId, eventId
 */
export async function POST(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const body = await request.json();
		const { content, title, projectId, eventId, tags, topics } = body;

		if (!content || typeof content !== "string" || content.trim().length === 0) {
			return badRequest("content is required");
		}

		// Validate at most one parent
		if (projectId && eventId) {
			return badRequest("Post can belong to at most one of projectId or eventId");
		}

		// Verify parent exists and belongs to user if provided
		if (projectId) {
			const project = await prisma.project.findUnique({ where: { id: projectId } });
			if (!project) {
				return badRequest("Project not found");
			}
			// For updates, the post should be created by the same owner as the project
			if (project.ownerId !== ctx.activeOwnerId) {
				return badRequest("Cannot create post for a project you don't own");
			}
		}

		if (eventId) {
			const event = await prisma.event.findUnique({ where: { id: eventId } });
			if (!event) {
				return badRequest("Event not found");
			}
			// For updates, the post should be created by the same owner as the event
			if (event.ownerId !== ctx.activeOwnerId) {
				return badRequest("Cannot create post for an event you don't own");
			}
		}

		const post = await prisma.post.create({
			data: {
				ownerId: ctx.activeOwnerId,
				content: content.trim(),
				title: title?.trim() || null,
				projectId: projectId || null,
				eventId: eventId || null,
				tags: Array.isArray(tags) ? tags : [],
				topics: Array.isArray(topics) ? topics : [],
			},
		});

		return success(
			{
				post: {
					id: post.id,
					ownerId: post.ownerId,
					title: post.title,
					content: post.content,
					projectId: post.projectId,
					eventId: post.eventId,
					tags: post.tags,
					topics: post.topics,
					createdAt: post.createdAt,
					updatedAt: post.updatedAt,
				},
			},
			201
		);
	} catch (error) {
		console.error("POST /api/posts error:", error);
		return serverError();
	}
}

/**
 * GET /api/posts
 * List posts with optional filters
 * 
 * Query: ?ownerId=...&projectId=...&eventId=...
 */
export async function GET(request: Request) {
	try {
		const url = new URL(request.url);
		const ownerId = url.searchParams.get("ownerId");
		const projectId = url.searchParams.get("projectId");
		const eventId = url.searchParams.get("eventId");

		const posts = await prisma.post.findMany({
			where: {
				...(ownerId ? { ownerId } : {}),
				...(projectId ? { projectId } : {}),
				...(eventId ? { eventId } : {}),
			},
			include: {
				owner: {
					select: {
						id: true,
						type: true,
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
			orderBy: { createdAt: "desc" },
			take: 50,
		});

		return success({
			posts: posts.map((p) => ({
				id: p.id,
				ownerId: p.ownerId,
				title: p.title,
				content: p.content,
				projectId: p.projectId,
				eventId: p.eventId,
				tags: p.tags,
				topics: p.topics,
				createdAt: p.createdAt,
				updatedAt: p.updatedAt,
				owner: {
					id: p.owner.id,
					type: p.owner.type,
					user: p.owner.user,
					org: p.owner.org,
				},
			})),
		});
	} catch (error) {
		console.error("GET /api/posts error:", error);
		return serverError();
	}
}
