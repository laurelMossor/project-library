// ⚠️ SERVER-ONLY: Storage utilities for Supabase
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.
//
// Configuration:
// - Bucket name: "uploads" (must exist in Supabase Storage and be set to PUBLIC)
// - Supabase URL: NEXT_PUBLIC_SUPABASE_URL (e.g., https://xxxxx.supabase.co)
// - Service Role Key: SUPABASE_SERVICE_ROLE_KEY (for server-side uploads, bypasses RLS)
//
// Debug mode: Set DEBUG_UPLOADS=true to see detailed upload information

import { supabase } from "./supabase";

const BUCKET_NAME = "uploads";
// const USE_SIGNED_URLS = false;
// const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour; unused while USE_SIGNED_URLS is false

export type UploadImageResult =
	| { imageUrl: string; path: string; error: null }
	| { imageUrl: null; path: string | null; error: string };

/**
 * Upload an image file to Supabase storage
 * @param file - The file to upload
 * @param folder - Optional folder path within the bucket (e.g., "projects", "profiles")
 * @returns The public URL of the uploaded image
 */
export async function uploadImage(
	file: File,
	folder: string = "user-uploads"
): Promise<UploadImageResult> {
	try {
		const debug = process.env.DEBUG_UPLOADS === "true";

		// Generate unique filename: timestamp-random.{ext}
		const timestamp = Date.now();
		const random = Math.random().toString(36).substring(2, 9);
		const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
		const filename = `${timestamp}-${random}.${extension}`;
		// Supabase Storage "folders" are just key prefixes.
		// Allow passing an empty folder to upload directly to the bucket root.
		const filepath = folder ? `${folder}/${filename}` : filename;

		// Helpful when debugging: shows the exact REST URLs being used.
		// Upload uses POST `${SUPABASE_URL}/storage/v1/object/<bucket>/<path>` (no /public/ in upload endpoint)
		// Public access uses GET `${SUPABASE_URL}/storage/v1/object/public/<bucket>/<path>`
		if (debug || process.env.NODE_ENV !== "production") {
			const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
			if (supabaseUrl) {
				console.log("[storage] Upload endpoint:", `${supabaseUrl}/storage/v1/object/${BUCKET_NAME}/${filepath}`);
				console.log("[storage] Public URL will be:", `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${filepath}`);
			} else {
				console.log("[storage] upload target bucket/path:", { bucket: BUCKET_NAME, filepath });
			}
		}

		// Convert file to buffer
		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);

		// Upload to Supabase storage
		const { data, error } = await supabase.storage
			.from(BUCKET_NAME)
			.upload(filepath, buffer, {
				contentType: file.type,
				upsert: false,
			});

		if (error) {
			const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
			console.error("[storage] Upload failed:", {
				error: error.message,
				code: error.statusCode || error.error || "unknown",
				bucket: BUCKET_NAME,
				filepath,
				supabaseUrl: supabaseUrl || "NOT SET",
				// Common issues:
				// - Bucket doesn't exist: check Supabase dashboard
				// - Bucket not public: set bucket to public in Supabase Storage settings
				// - Service role key invalid: check SUPABASE_SERVICE_ROLE_KEY env var
			});
			return { imageUrl: null, path: filepath, error: error.message };
		}

		// if (USE_SIGNED_URLS) {
		// 	const { data: signedData, error: signedError } = await supabase.storage
		// 		.from(BUCKET_NAME)
		// 		.createSignedUrl(filepath, SIGNED_URL_TTL_SECONDS);

		// 	if (signedError || !signedData?.signedUrl) {
		// 		console.error("Error creating signed URL:", signedError);
		// 		return { imageUrl: null, error: signedError?.message || "Failed to create signed URL" };
		// 	}

		// 	return { imageUrl: signedData.signedUrl, error: null };
		// }

		// Get public URL (bucket must be PUBLIC in Supabase Storage settings)
		const {
			data: { publicUrl },
		} = supabase.storage.from(BUCKET_NAME).getPublicUrl(filepath);

		if (debug || process.env.NODE_ENV !== "production") {
			console.log("[storage] Upload successful. Public URL:", publicUrl);
		}

		return { imageUrl: publicUrl, path: filepath, error: null };
	} catch (error) {
		console.error("Error uploading image:", error);
		return {
			imageUrl: null,
			path: null,
			error: error instanceof Error ? error.message : "Failed to upload image",
		};
	}
}

/**
 * Delete an image from Supabase storage
 * @param imageUrl - The public URL of the image to delete
 * @returns Success status and error if any
 */
export async function deleteImage(
	imageUrl: string
): Promise<{ success: boolean; error: string | null }> {
	try {
		// Extract file path from URL
		const url = new URL(imageUrl);
		const pathParts = url.pathname.split("/");
		const bucketIndex = pathParts.findIndex((part) => part === BUCKET_NAME);
		
		if (bucketIndex === -1) {
			return { success: false, error: "Invalid image URL" };
		}

		const filepath = pathParts.slice(bucketIndex + 1).join("/");

		const { error } = await supabase.storage.from(BUCKET_NAME).remove([filepath]);

		if (error) {
			console.error("Error deleting from Supabase:", error);
			return { success: false, error: error.message };
		}

		return { success: true, error: null };
	} catch (error) {
		console.error("Error deleting image:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to delete image",
		};
	}
}
