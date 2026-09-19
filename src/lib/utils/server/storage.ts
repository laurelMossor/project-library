// ⚠️ SERVER-ONLY: Storage utilities
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.
//
// In production (NEXT_PUBLIC_SUPABASE_URL set): uploads go to Supabase Storage bucket "uploads"
// In development (no Supabase URL): uploads go to public/uploads/ and are served as static assets
//
// Supabase configuration:
// - Bucket name: "uploads" (must exist in Supabase Storage and be set to PUBLIC)
// - Supabase URL: NEXT_PUBLIC_SUPABASE_URL (e.g., https://xxxxx.supabase.co)
// - Service Role Key: SUPABASE_SERVICE_ROLE_KEY (for server-side uploads, bypasses RLS)
//
// Debug mode: Set DEBUG_UPLOADS=true to see detailed upload information

import fs from "fs";
import path from "path";
import { getSupabaseClient } from "./supabase";

const BUCKET_NAME = "uploads";
// const USE_SIGNED_URLS = false;
// const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour; unused while USE_SIGNED_URLS is false

/**
 * Does `url` resolve to this app's own storage (the Supabase `uploads` bucket in prod, or the
 * local /uploads/ static path in dev)? Guards the /api/images metadata route so a client can't
 * persist an Image row pointing at an arbitrary external host (finding #23).
 */
export function isAllowedImageUrl(url: string): boolean {
	if (typeof url !== "string" || url.length === 0) return false;
	// Dev: local static uploads served from public/uploads/.
	if (url.startsWith("/uploads/")) return true;
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	if (!supabaseUrl) return false;
	const prefix = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET_NAME}/`;
	return url.startsWith(prefix);
}

/** A storage object path must stay within the bucket — no absolute paths or `..` traversal. */
export function isAllowedStoragePath(path: string): boolean {
	if (typeof path !== "string" || path.length === 0) return false;
	if (path.startsWith("/")) return false;
	return !path.split("/").includes("..");
}

export type UploadImageResult =
	| { imageUrl: string; path: string; error: null }
	| { imageUrl: null; path: string | null; error: string };

/** Bytes + metadata for a source-agnostic upload (a File, or bytes fetched from Telegram). */
export type ImageBytes = {
	buffer: Buffer;
	/** MIME type, e.g. "image/jpeg". */
	contentType: string;
	/** File extension without the dot, e.g. "jpg". Defaults to "jpg". */
	extension?: string;
};

/** Build a unique `timestamp-random.ext` object key, optionally under a folder prefix. */
function buildFilepath(folder: string, extension: string): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 9);
	const filename = `${timestamp}-${random}.${extension || "jpg"}`;
	// Supabase "folders" are just key prefixes; an empty folder uploads to the bucket root.
	return folder ? `${folder}/${filename}` : filename;
}

/** Turn a File into ImageBytes (buffer + type + extension) for the shared upload core. */
async function fileToImageBytes(file: File): Promise<ImageBytes> {
	return {
		buffer: Buffer.from(await file.arrayBuffer()),
		contentType: file.type,
		extension: file.name.split(".").pop()?.toLowerCase() || "jpg",
	};
}

/**
 * Choose the right storage backend for raw bytes: Supabase in prod (NEXT_PUBLIC_SUPABASE_URL
 * set), local `public/uploads/` in dev. This is the one place callers (upload route, Telegram
 * webhook) go through, so the dev/prod branch isn't restated per call site.
 */
export async function storeImageBytes(
	bytes: ImageBytes,
	folder: string = "user-uploads",
): Promise<UploadImageResult> {
	return process.env.NEXT_PUBLIC_SUPABASE_URL
		? uploadImageBuffer(bytes, folder)
		: uploadBufferLocally(bytes, folder);
}

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
	return uploadImageBuffer(await fileToImageBytes(file), folder);
}

/**
 * Upload raw image bytes to Supabase storage. Shared core behind `uploadImage` (File) and
 * the Telegram webhook (bytes fetched from `getFile`), so both go through one upload path.
 */
export async function uploadImageBuffer(
	{ buffer, contentType, extension }: ImageBytes,
	folder: string = "user-uploads"
): Promise<UploadImageResult> {
	try {
		const debug = process.env.DEBUG_UPLOADS === "true";
		const filepath = buildFilepath(folder, extension || "jpg");

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

		// Upload to Supabase storage
		const supabase = getSupabaseClient();
		const { error } = await supabase.storage
			.from(BUCKET_NAME)
			.upload(filepath, buffer, {
				contentType,
				upsert: false,
			});

		if (error) {
			const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
			console.error("[storage] Upload failed:", {
				error: error.message,
				code: (error as any).statusCode || (error as any).error || "unknown",
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
		} = getSupabaseClient().storage.from(BUCKET_NAME).getPublicUrl(filepath);

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

		const supabase = getSupabaseClient();
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

/**
 * Upload an image to the local filesystem (dev only).
 * Files are written to public/uploads/{folder}/ and served as static assets at /uploads/{folder}/filename.
 */
export async function uploadImageLocally(
	file: File,
	folder: string = "user-uploads"
): Promise<UploadImageResult> {
	return uploadBufferLocally(await fileToImageBytes(file), folder);
}

/** Local-filesystem variant of `uploadImageBuffer` (dev only). Shared core behind both File and byte callers. */
export async function uploadBufferLocally(
	{ buffer, extension }: ImageBytes,
	folder: string = "user-uploads"
): Promise<UploadImageResult> {
	try {
		const filepath = buildFilepath(folder, extension || "jpg");
		const uploadsDir = path.join(process.cwd(), "public", "uploads", folder);
		fs.mkdirSync(uploadsDir, { recursive: true });

		// filepath is `${folder}/${filename}` (or just filename); write to the folder dir.
		const filename = filepath.includes("/") ? filepath.slice(filepath.lastIndexOf("/") + 1) : filepath;
		fs.writeFileSync(path.join(uploadsDir, filename), buffer);

		return { imageUrl: `/uploads/${filepath}`, path: filepath, error: null };
	} catch (error) {
		console.error("Error saving image locally:", error);
		return {
			imageUrl: null,
			path: null,
			error: error instanceof Error ? error.message : "Failed to save image locally",
		};
	}
}
