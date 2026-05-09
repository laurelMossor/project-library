const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DIMENSION = 4000;

export type ImageValidationResult = {
	valid: boolean;
	error?: string;
};

/**
 * Validates an image file
 * @param file - The file to validate
 * @returns Validation result with error message if invalid
 */
export function validateImageFile(file: File): ImageValidationResult {
	// Validate file type
	if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
		return {
			valid: false,
			error: "Invalid file type. Only JPEG, PNG, and WebP images are allowed",
		};
	}

	// Validate file size
	if (file.size > MAX_IMAGE_SIZE) {
		return {
			valid: false,
			error: "File size too large. Maximum size is 5MB",
		};
	}

	return { valid: true };
}

/**
 * Creates a preview URL for an image file
 * @param file - The image file
 * @returns Promise that resolves to a data URL string
 */
export function createImagePreview(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			if (typeof reader.result === "string") {
				resolve(reader.result);
			} else {
				reject(new Error("Failed to create image preview"));
			}
		};
		reader.onerror = () => reject(new Error("Failed to read image file"));
		reader.readAsDataURL(file);
	});
}

/**
 * Formats image size in bytes to human-readable string
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "2.5 MB")
 */
export function formatImageSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
		img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
		img.src = url;
	});
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => blob ? resolve(blob) : reject(new Error("Canvas conversion failed")),
			type,
			quality,
		);
	});
}

export async function compressImage(file: File): Promise<File> {
	const img = await loadImage(file);

	let { width, height } = img;
	const longest = Math.max(width, height);
	if (longest > MAX_DIMENSION) {
		const scale = MAX_DIMENSION / longest;
		width = Math.round(width * scale);
		height = Math.round(height * scale);
	}

	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d")!;
	ctx.drawImage(img, 0, 0, width, height);

	const qualities = [0.8, 0.6, 0.4];
	for (const quality of qualities) {
		const blob = await canvasToBlob(canvas, "image/jpeg", quality);
		if (blob.size <= MAX_IMAGE_SIZE) {
			return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
		}
	}

	throw new Error("Image is too large even after compression. Please use a smaller image.");
}

