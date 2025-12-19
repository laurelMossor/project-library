import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized, badRequest } from "@/lib/utils/errors";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

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

		// Generate unique filename: timestamp-random.{ext}
		const timestamp = Date.now();
		const random = Math.random().toString(36).substring(2, 9);
		const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
		const filename = `${timestamp}-${random}.${extension}`;

		// Create uploads directory if it doesn't exist
		const uploadsDir = join(process.cwd(), "public", "uploads", "projects");
		if (!existsSync(uploadsDir)) {
			await mkdir(uploadsDir, { recursive: true });
		}

		// Convert file to buffer and save
		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);
		const filepath = join(uploadsDir, filename);
		await writeFile(filepath, buffer);

		// Return the public URL path
		const imageUrl = `/uploads/projects/${filename}`;

		return NextResponse.json({ imageUrl }, { status: 200 });
	} catch (error) {
		console.error("Error uploading image:", error);
		return badRequest("Failed to upload image");
	}
}

