import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { success, unauthorized, badRequest, serverError } from "@/lib/utils/server/api-response";

/**
 * POST /api/projects
 * Create a project attributed to activeOwnerId
 * 
 * Body: { title: string, description: string, tags?: string[], topics?: string[] }
 */
export async function POST(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const body = await request.json();
		const { title, description, tags, topics } = body;

		if (!title || typeof title !== "string" || title.trim().length === 0) {
			return badRequest("title is required");
		}

		if (!description || typeof description !== "string") {
			return badRequest("description is required");
		}

		const project = await prisma.project.create({
			data: {
				ownerId: ctx.activeOwnerId,
				title: title.trim(),
				description: description.trim(),
				tags: Array.isArray(tags) ? tags : [],
				topics: Array.isArray(topics) ? topics : [],
			},
		});

		return success(
			{
				project: {
					id: project.id,
					ownerId: project.ownerId,
					title: project.title,
					description: project.description,
					tags: project.tags,
					topics: project.topics,
					createdAt: project.createdAt,
					updatedAt: project.updatedAt,
				},
			},
			201
		);
	} catch (error) {
		console.error("POST /api/projects error:", error);
		return serverError();
	}
}

/**
 * GET /api/projects
 * List projects with optional filters
 * 
 * Query: ?ownerId=...&orgId=...&userId=...
 */
export async function GET(request: Request) {
	try {
		const url = new URL(request.url);
		const ownerId = url.searchParams.get("ownerId");
		const orgId = url.searchParams.get("orgId");
		const userId = url.searchParams.get("userId");

		const projects = await prisma.project.findMany({
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
			orderBy: { createdAt: "desc" },
			take: 50,
		});

		return success({
			projects: projects.map((p) => ({
				id: p.id,
				ownerId: p.ownerId,
				title: p.title,
				description: p.description,
				tags: p.tags,
				topics: p.topics,
				createdAt: p.createdAt,
				updatedAt: p.updatedAt,
				owner: {
					id: p.owner.id,
					type: p.owner.type,
					user: p.owner.user
						? {
								id: p.owner.user.id,
								username: p.owner.user.username,
								displayName: p.owner.user.displayName,
						  }
						: null,
					org: p.owner.org
						? {
								id: p.owner.org.id,
								slug: p.owner.org.slug,
								name: p.owner.org.name,
						  }
						: null,
				},
			})),
		});
	} catch (error) {
		console.error("GET /api/projects error:", error);
		return serverError();
	}
}
