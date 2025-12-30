// ⚠️ SERVER-ONLY: Storage utilities for Supabase
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { supabase } from "./supabase";

const BUCKET_NAME = "private";

/**
 * Upload an image file to Supabase storage
 * @param file - The file to upload
 * @param folder - Optional folder path within the bucket (e.g., "projects", "profiles")
 * @returns The public URL of the uploaded image
 */
export async function uploadImage(
	file: File,
	folder: string = "user-uploads"
): Promise<{ imageUrl: string; error: null } | { imageUrl: null; error: string }> {
	try {
		// Generate unique filename: timestamp-random.{ext}
		const timestamp = Date.now();
		const random = Math.random().toString(36).substring(2, 9);
		const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
		const filename = `${timestamp}-${random}.${extension}`;
		const filepath = `${folder}/${filename}`;

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
			console.error("Error uploading to Supabase:", error);
			return { imageUrl: null, error: error.message };
		}

		// Get public URL
		const {
			data: { publicUrl },
		} = supabase.storage.from(BUCKET_NAME).getPublicUrl(filepath);

		return { imageUrl: publicUrl, error: null };
	} catch (error) {
		console.error("Error uploading image:", error);
		return {
			imageUrl: null,
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
