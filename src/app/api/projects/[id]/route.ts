import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { success, unauthorized, forbidden, notFound, badRequest, serverError } from "@/lib/utils/server/api-response";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/:id
 * Get a project by ID
 */
export async function GET(request: Request, { params }: Params) {
	try {
		const { id } = await params;

		const project = await prisma.project.findUnique({
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

		if (!project) {
			return notFound("Project not found");
		}

		return success({
			project: {
				id: project.id,
				ownerId: project.ownerId,
				title: project.title,
				description: project.description,
				tags: project.tags,
				topics: project.topics,
				createdAt: project.createdAt,
				updatedAt: project.updatedAt,
				owner: {
					id: project.owner.id,
					type: project.owner.type,
					user: project.owner.user,
					org: project.owner.org,
				},
				posts: project.posts,
			},
		});
	} catch (error) {
		console.error("GET /api/projects/:id error:", error);
		return serverError();
	}
}

/**
 * PATCH /api/projects/:id
 * Update a project (must be owner)
 * 
 * Body: { title?: string, description?: string, tags?: string[], topics?: string[] }
 */
export async function PATCH(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { id } = await params;
		const body = await request.json();

		// Verify project exists and belongs to active owner
		const project = await prisma.project.findUnique({ where: { id } });
		if (!project) {
			return notFound("Project not found");
		}

		if (project.ownerId !== ctx.activeOwnerId) {
			return forbidden("You can only edit your own projects");
		}

		const { title, description, tags, topics } = body;

		const updated = await prisma.project.update({
			where: { id },
			data: {
				...(title !== undefined ? { title: title.trim() } : {}),
				...(description !== undefined ? { description: description.trim() } : {}),
				...(tags !== undefined ? { tags } : {}),
				...(topics !== undefined ? { topics } : {}),
			},
		});

		return success({
			project: {
				id: updated.id,
				ownerId: updated.ownerId,
				title: updated.title,
				description: updated.description,
				tags: updated.tags,
				topics: updated.topics,
				createdAt: updated.createdAt,
				updatedAt: updated.updatedAt,
			},
		});
	} catch (error) {
		console.error("PATCH /api/projects/:id error:", error);
		return serverError();
	}
}

/**
 * DELETE /api/projects/:id
 * Delete a project (must be owner)
 */
export async function DELETE(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { id } = await params;

		// Verify project exists and belongs to active owner
		const project = await prisma.project.findUnique({ where: { id } });
		if (!project) {
			return notFound("Project not found");
		}

		if (project.ownerId !== ctx.activeOwnerId) {
			return forbidden("You can only delete your own projects");
		}

		await prisma.project.delete({ where: { id } });

		return success({ deleted: true });
	} catch (error) {
		console.error("DELETE /api/projects/:id error:", error);
		return serverError();
	}
}
