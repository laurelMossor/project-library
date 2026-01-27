import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { success, unauthorized, badRequest, serverError } from "@/lib/utils/server/api-response";

/**
 * POST /api/images
 * Create image metadata attributed to activeOwnerId
 * (Actual file upload can use a signed URL flow)
 * 
 * Body: { url: string, path: string, altText?: string }
 */
export async function POST(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const body = await request.json();
		const { url, path, altText } = body;

		if (!url || typeof url !== "string") {
			return badRequest("url is required");
		}

		if (!path || typeof path !== "string") {
			return badRequest("path is required");
		}

		const image = await prisma.image.create({
			data: {
				url,
				path,
				altText: altText || null,
				uploadedById: ctx.activeOwnerId,
			},
		});

		return success(
			{
				image: {
					id: image.id,
					url: image.url,
					path: image.path,
					altText: image.altText,
					uploadedById: image.uploadedById,
					createdAt: image.createdAt,
				},
			},
			201
		);
	} catch (error) {
		console.error("POST /api/images error:", error);
		return serverError();
	}
}

/**
 * GET /api/images
 * List images uploaded by activeOwnerId
 */
export async function GET(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const images = await prisma.image.findMany({
			where: { uploadedById: ctx.activeOwnerId },
			orderBy: { createdAt: "desc" },
			take: 50,
		});

		return success({
			images: images.map((i) => ({
				id: i.id,
				url: i.url,
				path: i.path,
				altText: i.altText,
				createdAt: i.createdAt,
			})),
		});
	} catch (error) {
		console.error("GET /api/images error:", error);
		return serverError();
	}
}
