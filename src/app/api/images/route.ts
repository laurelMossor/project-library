import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, serverError } from "@/lib/utils/errors";

/**
 * POST /api/images
 * Create image metadata attributed to activeOwnerId
 * Protected endpoint
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

		// Validate altText if provided
		if (altText !== undefined && altText !== null) {
			if (typeof altText !== "string") {
				return badRequest("altText must be a string");
			}
			if (altText.length > 500) {
				return badRequest("altText must be 500 characters or less");
			}
		}

		const image = await prisma.image.create({
			data: {
				url,
				path,
				altText: altText || null,
				uploadedById: ctx.activeOwnerId,
			},
		});

		return NextResponse.json(
			{
				id: image.id,
				url: image.url,
				path: image.path,
				altText: image.altText,
				uploadedById: image.uploadedById,
				createdAt: image.createdAt,
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error("POST /api/images error:", error);
		return serverError();
	}
}

/**
 * GET /api/images
 * List images uploaded by activeOwnerId
 * Protected endpoint
 */
export async function GET() {
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

		const imagesList = images.map((i) => ({
			id: i.id,
			url: i.url,
			path: i.path,
			altText: i.altText,
			createdAt: i.createdAt,
		}));

		return NextResponse.json(imagesList);
	} catch (error) {
		console.error("GET /api/images error:", error);
		return serverError();
	}
}
