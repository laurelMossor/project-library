import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/images/:id
 * Update image metadata (altText, caption). Only the uploader can edit.
 * Protected endpoint
 *
 * Body: { altText?: string | null, caption?: string | null }
 */
export async function PATCH(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();

		const { id } = await params;

		const existing = await prisma.image.findUnique({
			where: { id },
			select: { uploadedByUserId: true },
		});

		if (!existing) return notFound("Image not found");

		if (existing.uploadedByUserId !== ctx.userId) {
			return NextResponse.json({ error: "You can only edit your own images" }, { status: 403 });
		}

		const body = await request.json();
		const { altText, caption } = body;

		if (altText !== undefined && altText !== null) {
			if (typeof altText !== "string") return badRequest("altText must be a string");
			if (altText.length > 500) return badRequest("altText must be 500 characters or less");
		}

		if (caption !== undefined && caption !== null) {
			if (typeof caption !== "string") return badRequest("caption must be a string");
			if (caption.length > 500) return badRequest("caption must be 500 characters or less");
		}

		const updateData: Record<string, unknown> = {};
		if (altText !== undefined) updateData.altText = altText === "" ? null : altText;
		if (caption !== undefined) updateData.caption = caption === "" ? null : caption;

		const image = await prisma.image.update({
			where: { id },
			data: updateData,
			select: { id: true, url: true, path: true, altText: true, caption: true, uploadedByUserId: true, createdAt: true },
		});

		return NextResponse.json(image);
	} catch (error) {
		console.error("PATCH /api/images/:id error:", error);
		return serverError("Failed to update image");
	}
}
