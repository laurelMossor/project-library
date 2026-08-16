import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, serverError } from "@/lib/utils/errors";
import { uploadImage, uploadImageLocally } from "@/lib/utils/server/storage";
import { createImage } from "@/lib/utils/server/image-attachment";

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

		// Use local filesystem in dev (no Supabase URL), Supabase in production
		const result = process.env.NEXT_PUBLIC_SUPABASE_URL
			? await uploadImage(file, folder)
			: await uploadImageLocally(file, folder);

		if (result.error || !result.imageUrl) {
			return serverError(result.error || "Upload failed");
		}

		// Create Image record in database (shared helper — same path as the Telegram webhook)
		const image = await createImage({
			url: result.imageUrl,
			path: result.path!,
			uploadedByUserId: ctx.userId,
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
