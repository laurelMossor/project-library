import { prisma } from "@/lib/utils/server/prisma";
import { success, notFound, serverError } from "@/lib/utils/server/api-response";

type Params = { params: Promise<{ orgId: string }> };

/**
 * GET /api/orgs/:orgId
 * Get org profile
 */
export async function GET(request: Request, { params }: Params) {
	try {
		const { orgId } = await params;

		const org = await prisma.org.findUnique({
			where: { id: orgId },
			select: {
				id: true,
				slug: true,
				name: true,
				headline: true,
				bio: true,
				location: true,
				isPublic: true,
				avatarImageId: true,
				createdAt: true,
				updatedAt: true,
				addressLine1: true,
				addressLine2: true,
				city: true,
				state: true,
				zip: true,
				parentTopic: true,
				tags: true,
			},
		});

		if (!org) {
			return notFound("Org not found");
		}

		return success({ org });
	} catch (error) {
		console.error("GET /api/orgs/:orgId error:", error);
		return serverError();
	}
}
