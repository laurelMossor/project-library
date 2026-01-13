/**
 * Generate a URL-safe slug from a string
 * Converts to lowercase, replaces spaces with hyphens, removes special characters
 */
export function generateSlug(text: string): string {
	return text
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, "") // Remove special characters
		.replace(/\s+/g, "-") // Replace spaces with hyphens
		.replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
		.replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}
