/**
 * Image type - matches Prisma schema
 * Represents an image stored in Supabase Storage with metadata
 */
export interface ImageItem {
	id: string;
	url: string; // Full Supabase public URL
	path: string; // Storage path (e.g., "1735123456789-abc1234.jpg")
	altText: string | null; // Optional alt text for accessibility
	projectId: string | null; // Foreign key to Project (if image belongs to a project)
	eventId: string | null; // Foreign key to Event (if image belongs to an event)
	uploadedById: string; // Who uploaded the image
	createdAt: Date;
}

/**
 * Image data for creating a new image
 * Derived from ImageItem, excluding auto-generated fields
 */
export type ImageCreateInput = Omit<ImageItem, "id" | "createdAt">;

/**
 * Image data for updating an existing image
 * Only updatable fields (url, path, and relations should not be updated after creation)
 */
export type ImageUpdateInput = Partial<Pick<ImageItem, "altText">>;

