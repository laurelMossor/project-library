import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized, badRequest } from "@/lib/utils/errors";
import { uploadImage } from "@/lib/utils/server/storage";
import { prisma } from "@/lib/utils/server/prisma";
import { ImageItem } from "@/lib/types/image";
import { imageFields } from "@/lib/utils/server/fields";

// POST /api/projects/upload - Upload an image for a project or event
// Protected endpoint (requires authentication)
//
// Configuration:
// - Bucket: "uploads" (must be PUBLIC in Supabase Storage settings)
// - Uploads to bucket root (no folder prefix)
// - Creates Image record linked to project or event
// - Returns ImageItem with all image metadata
//
// Debug: Set DEBUG_UPLOADS=true to see detailed upload information
export async function POST(request: Request) {
	const session = await auth();
	const debug = process.env.DEBUG_UPLOADS === "true";

	if (!session?.user?.id) {
		return unauthorized();
	}

	try {
		const formData = await request.formData();
		const file = formData.get("image") as File | null;
		const projectId = formData.get("projectId") as string | null;
		const eventId = formData.get("eventId") as string | null;
		const altText = formData.get("altText") as string | null;

		if (!file) {
			return badRequest("No image file provided");
		}

		// Require either projectId or eventId (image must be linked to a collection item)
		if (!projectId && !eventId) {
			return badRequest("Either projectId or eventId must be provided");
		}

		// Validate that only one collection type is specified
		if (projectId && eventId) {
			return badRequest("Cannot specify both projectId and eventId");
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

		// Verify the project/event exists and user owns it before uploading
		if (projectId) {
			const project = await prisma.project.findUnique({
				where: { id: projectId },
				select: { ownerId: true },
			});
			if (!project) {
				return badRequest("Project not found");
			}
			if (project.ownerId !== session.user.id) {
				return unauthorized("You can only add images to your own projects");
			}
		}
		if (eventId) {
			const event = await prisma.event.findUnique({
				where: { id: eventId },
				select: { ownerId: true },
			});
			if (!event) {
				return badRequest("Event not found");
			}
			if (event.ownerId !== session.user.id) {
				return unauthorized("You can only add images to your own events");
			}
		}

		// Upload to Supabase storage
		// Upload directly to the `uploads` bucket root (no folder prefix)
		const result = await uploadImage(file, "");

		if (result.error) {
			if (debug) {
				const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
				const bucket = "uploads";
				// Public bucket URLs use /storage/v1/object/public/ prefix
				const target =
					supabaseUrl && result.path ? `${supabaseUrl}/storage/v1/object/public/${bucket}/${result.path}` : null;

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

		// Create Image record in database
		// At this point we know result.imageUrl and result.path are not null (upload succeeded)
		if (!result.imageUrl || !result.path) {
			return badRequest("Upload succeeded but did not return image URL or path");
		}

		const createdImage = await prisma.image.create({
			data: {
				url: result.imageUrl,
				path: result.path,
				altText: altText?.trim() || null,
				projectId: projectId || null,
				eventId: eventId || null,
				uploadedById: session.user.id,
			},
			select: imageFields,
		});
		const imageRecord = createdImage as ImageItem;

		if (debug) {
			const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
			const bucket = "uploads";
			// Public bucket URLs use /storage/v1/object/public/ prefix
			const target =
				supabaseUrl && result.path ? `${supabaseUrl}/storage/v1/object/public/${bucket}/${result.path}` : null;

			return NextResponse.json(
				{
					...imageRecord,
					debug: {
						bucket,
						path: result.path,
						target,
						supabaseUrlPresent: Boolean(supabaseUrl),
						file: { type: file.type, size: file.size, name: file.name },
						linkedToProject: Boolean(projectId),
						linkedToEvent: Boolean(eventId),
					},
				},
				{ status: 200 }
			);
		}

		// Return ImageItem with all metadata
		return NextResponse.json(imageRecord, { status: 200 });
	} catch (error) {
		console.error("Error uploading image:", error);
		if (debug && error instanceof Error) {
			return badRequest(error.message);
		}
		return badRequest("Failed to upload image");
	}
}

