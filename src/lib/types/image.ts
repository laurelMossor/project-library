/**
 * Image type - matches Prisma schema v2
 * Represents an image stored in Supabase Storage with metadata
 * Note: Images are attached via ImageAttachment, not direct foreign keys
 */
export interface ImageItem {
	id: string;
	url: string; // Full Supabase public URL
	path: string; // Storage path (e.g., "1735123456789-abc1234.jpg")
	altText: string | null; // Optional alt text for accessibility
	uploadedById: string; // Who uploaded the image
	createdAt: Date;
	// Note: projectId/eventId removed - use ImageAttachment instead
}

/**
 * ImageAttachment type - matches Prisma schema v2
 * Represents the polymorphic attachment of images to targets
 */
export interface ImageAttachmentItem {
	id: string;
	imageId: string;
	type: "PROJECT" | "EVENT" | "POST";
	targetId: string; // ID of the target (project, event, or post)
	sortOrder: number;
	createdAt: Date;
	image?: ImageItem; // Optional, included when loading with image relation
}

export type AttachmentType = "PROJECT" | "EVENT" | "POST";

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

