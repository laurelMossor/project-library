import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, serverError } from "@/lib/utils/errors";
import { uploadImage } from "@/lib/utils/server/storage";

/**
 * POST /api/upload
 * Upload an image file to Supabase and create an Image record
 * Protected endpoint
 *
 * Body: FormData with "file" field
 * Optional query param: folder (default: "user-uploads")
 * Returns: { id, url, path }
 */
export async function POST(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const formData = await request.formData();
		const file = formData.get("file");

		if (!file || !(file instanceof File)) {
			return badRequest("No file provided");
		}

		// Validate file type
		const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
		if (!allowedTypes.includes(file.type)) {
			return badRequest("Invalid file type. Only JPEG, PNG, and WebP are allowed.");
		}

		// Validate file size (5MB max)
		const maxSize = 5 * 1024 * 1024;
		if (file.size > maxSize) {
			return badRequest("File too large. Maximum size is 5MB.");
		}

		// Determine folder from query param
		const { searchParams } = new URL(request.url);
		const folder = searchParams.get("folder") || "user-uploads";

		// Upload to Supabase
		const result = await uploadImage(file, folder);

		if (result.error || !result.imageUrl) {
			return serverError(result.error || "Upload failed");
		}

		// Create Image record in database
		const image = await prisma.image.create({
			data: {
				url: result.imageUrl,
				path: result.path!,
				altText: null,
				uploadedByUserId: ctx.userId,
			},
		});

		return NextResponse.json(
			{
				id: image.id,
				url: image.url,
				path: image.path,
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error("POST /api/upload error:", error);
		return serverError();
	}
}
