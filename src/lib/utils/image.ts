/**
 * Image utility functions for file validation, preview creation, and formatting
 */

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

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

