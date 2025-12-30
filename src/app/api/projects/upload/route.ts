import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized, badRequest } from "@/lib/utils/errors";
import { uploadImage } from "@/lib/utils/server/storage";
import { prisma } from "@/lib/utils/server/prisma";

// POST /api/projects/upload - Upload an image for a project
// Protected endpoint (requires authentication)
//
// Configuration:
// - Bucket: "uploads" (must be PUBLIC in Supabase Storage settings)
// - Uploads to bucket root (no folder prefix)
// - Returns public URL for the uploaded image
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

		// Upload to Supabase storage.
		// Upload directly to the `uploads` bucket root (no `projects/` prefix).
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

		// Create Image record in database if projectId or eventId is provided
		let imageRecord = null;
		if (projectId || eventId) {
			// Verify the project/event exists and user owns it
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

			imageRecord = await prisma.image.create({
				data: {
					url: result.imageUrl,
					path: result.path,
					altText: altText?.trim() || null,
					projectId: projectId || null,
					eventId: eventId || null,
					uploadedById: session.user.id,
				},
			});
		}

		if (debug) {
			const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
			const bucket = "uploads";
			// Public bucket URLs use /storage/v1/object/public/ prefix
			const target =
				supabaseUrl && result.path ? `${supabaseUrl}/storage/v1/object/public/${bucket}/${result.path}` : null;

			return NextResponse.json(
				{
					imageUrl: result.imageUrl,
					imageId: imageRecord?.id || null,
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

		return NextResponse.json({ 
			imageUrl: result.imageUrl,
			imageId: imageRecord?.id || null,
		}, { status: 200 });
	} catch (error) {
		console.error("Error uploading image:", error);
		if (debug && error instanceof Error) {
			return badRequest(error.message);
		}
		return badRequest("Failed to upload image");
	}
}

