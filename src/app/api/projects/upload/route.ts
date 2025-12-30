import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized, badRequest } from "@/lib/utils/errors";
import { uploadImage } from "@/lib/utils/server/storage";

// POST /api/projects/upload - Upload an image for a project
// Protected endpoint (requires authentication)
export async function POST(request: Request) {
	const session = await auth();
	const debug = process.env.DEBUG_UPLOADS === "true";

	if (!session?.user?.id) {
		return unauthorized();
	}

	try {
		const formData = await request.formData();
		const file = formData.get("image") as File | null;

		if (!file) {
			return badRequest("No image file provided");
		}

		// Validate file type (images only)
		const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
		if (!allowedTypes.includes(file.type)) {
			return badRequest("Invalid file type. Only JPEG, PNG, and WebP images are allowed");
		}

		// Validate file size (max 5MB)
		const maxSize = 5 * 1024 * 1024; // 5MB in bytes
		if (file.size > maxSize) {
			return badRequest("File size too large. Maximum size is 5MB");
		}

		// Upload to Supabase storage.
		// Upload directly to the `uploads` bucket root (no `projects/` prefix).
		const result = await uploadImage(file, "");

		if (result.error) {
			if (debug) {
				const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
				const bucket = "uploads";
				const target =
					supabaseUrl && result.path ? `${supabaseUrl}/storage/v1/object/${bucket}/${result.path}` : null;

				return NextResponse.json(
					{
						error: result.error,
						debug: {
							bucket,
							path: result.path,
							target,
							supabaseUrlPresent: Boolean(supabaseUrl),
							file: { type: file.type, size: file.size, name: file.name },
						},
					},
					{ status: 400 }
				);
			}
			return badRequest(result.error);
		}

		if (debug) {
			const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
			const bucket = "uploads";
			const target =
				supabaseUrl && result.path ? `${supabaseUrl}/storage/v1/object/${bucket}/${result.path}` : null;

			return NextResponse.json(
				{
					imageUrl: result.imageUrl,
					debug: {
						bucket,
						path: result.path,
						target,
						supabaseUrlPresent: Boolean(supabaseUrl),
						file: { type: file.type, size: file.size, name: file.name },
					},
				},
				{ status: 200 }
			);
		}

		return NextResponse.json({ imageUrl: result.imageUrl }, { status: 200 });
	} catch (error) {
		console.error("Error uploading image:", error);
		if (debug && error instanceof Error) {
			return badRequest(error.message);
		}
		return badRequest("Failed to upload image");
	}
}

