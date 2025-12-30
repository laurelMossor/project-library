import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized, badRequest } from "@/lib/utils/errors";
import { uploadImage } from "@/lib/utils/server/storage";

// POST /api/projects/upload - Upload an image for a project
// Protected endpoint (requires authentication)
export async function POST(request: Request) {
	const session = await auth();

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

		// Upload to Supabase storage
		const result = await uploadImage(file, "projects");

		if (result.error) {
			return badRequest(result.error);
		}

		return NextResponse.json({ imageUrl: result.imageUrl }, { status: 200 });
	} catch (error) {
		console.error("Error uploading image:", error);
		return badRequest("Failed to upload image");
	}
}

