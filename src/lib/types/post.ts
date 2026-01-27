/**
 * Post type - matches Prisma schema v0.3
 * Can be standalone or descendant (attached to Project/Event)
 * Posts are owned by Owner
 */
export interface PostItem {
	id: string;
	ownerId: string; // Owner that owns this post
	projectId: string | null; // Optional - if set, this is a descendant post of a project
	eventId: string | null; // Optional - if set, this is a descendant post of an event
	title: string | null; // Optional post title
	content: string; // Post content (required)
	tags: string[];
	topics: string[];
	createdAt: Date;
	updatedAt: Date;
	// Relations (optional, loaded when needed)
	owner?: { user?: { id: string; username: string; firstName: string | null; lastName: string | null } | null; org?: { id: string; name: string; slug: string } | null } | null;
	project?: { id: string; title: string } | null;
	event?: { id: string; title: string } | null;
}

/**
 * Post data for creating a new post
 * Derived from PostItem, excluding auto-generated fields and ownerId
 * (ownerId is handled internally by createPost function)
 * projectId and eventId are optional - only one should be set for descendant posts
 */
export type PostCreateInput = {
	projectId?: string | null;
	eventId?: string | null;
	title?: string | null;
	content: string;
	tags?: string[];
};

/**
 * Post data for updating an existing post
 * Only updatable fields
 */
export type PostUpdateInput = Partial<Pick<PostItem, "title" | "content" | "tags">>;

/**
 * Type guard to check if post is a project descendant
 */
export function isProjectPost(post: PostItem): post is PostItem & { projectId: string } {
	return post.projectId !== null;
}

/**
 * Type guard to check if post is an event descendant
 */
export function isEventPost(post: PostItem): post is PostItem & { eventId: string } {
	return post.eventId !== null;
}

/**
 * Type guard to check if post is standalone (no parent)
 */
export function isStandalonePost(post: PostItem): boolean {
	return post.projectId === null && post.eventId === null;
}

