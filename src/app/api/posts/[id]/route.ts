import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { success, unauthorized, forbidden, notFound, serverError } from "@/lib/utils/server/api-response";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/posts/:id
 * Get a post by ID
 */
export async function GET(request: Request, { params }: Params) {
	try {
		const { id } = await params;

		const post = await prisma.post.findUnique({
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
				project: {
					select: {
						id: true,
						title: true,
					},
				},
				event: {
					select: {
						id: true,
						title: true,
					},
				},
			},
		});

		if (!post) {
			return notFound("Post not found");
		}

		return success({
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
				owner: {
					id: post.owner.id,
					type: post.owner.type,
					user: post.owner.user,
					org: post.owner.org,
				},
				project: post.project,
				event: post.event,
			},
		});
	} catch (error) {
		console.error("GET /api/posts/:id error:", error);
		return serverError();
	}
}

/**
 * PATCH /api/posts/:id
 * Update a post (must be owner)
 * 
 * Body: { title?: string, content?: string, tags?: string[], topics?: string[] }
 */
export async function PATCH(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { id } = await params;
		const body = await request.json();

		// Verify post exists and belongs to active owner
		const post = await prisma.post.findUnique({ where: { id } });
		if (!post) {
			return notFound("Post not found");
		}

		if (post.ownerId !== ctx.activeOwnerId) {
			return forbidden("You can only edit your own posts");
		}

		const { title, content, tags, topics } = body;

		const updateData: Record<string, unknown> = {};
		if (title !== undefined) updateData.title = title?.trim() || null;
		if (content !== undefined) updateData.content = content.trim();
		if (tags !== undefined) updateData.tags = tags;
		if (topics !== undefined) updateData.topics = topics;

		const updated = await prisma.post.update({
			where: { id },
			data: updateData,
		});

		return success({
			post: {
				id: updated.id,
				ownerId: updated.ownerId,
				title: updated.title,
				content: updated.content,
				projectId: updated.projectId,
				eventId: updated.eventId,
				tags: updated.tags,
				topics: updated.topics,
				createdAt: updated.createdAt,
				updatedAt: updated.updatedAt,
			},
		});
	} catch (error) {
		console.error("PATCH /api/posts/:id error:", error);
		return serverError();
	}
}

/**
 * DELETE /api/posts/:id
 * Delete a post (must be owner)
 */
export async function DELETE(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { id } = await params;

		// Verify post exists and belongs to active owner
		const post = await prisma.post.findUnique({ where: { id } });
		if (!post) {
			return notFound("Post not found");
		}

		if (post.ownerId !== ctx.activeOwnerId) {
			return forbidden("You can only delete your own posts");
		}

		await prisma.post.delete({ where: { id } });

		return success({ deleted: true });
	} catch (error) {
		console.error("DELETE /api/posts/:id error:", error);
		return serverError();
	}
}
