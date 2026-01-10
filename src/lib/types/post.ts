/**
 * Post type - matches Prisma schema v2
 * Replaces Entry model - can be standalone or descendant (attached to Project/Event)
 * Posts are owned by Actor (User or Org)
 */
export interface PostItem {
	id: string;
	ownerActorId: string; // Actor that owns this post
	projectId: string | null; // Optional - if set, this is a descendant post of a project
	eventId: string | null; // Optional - if set, this is a descendant post of an event
	title: string | null; // Optional post title
	content: string; // Post content (required)
	createdAt: Date;
	updatedAt: Date;
	// Relations (optional, loaded when needed)
	owner?: { user?: { id: string; username: string; firstName: string | null; lastName: string | null } | null; org?: { id: string; name: string; slug: string } | null } | null;
	project?: { id: string; title: string } | null;
	event?: { id: string; title: string } | null;
}

/**
 * Post data for creating a new post
 * Derived from PostItem, excluding auto-generated fields
 */
export type PostCreateInput = Omit<PostItem, "id" | "createdAt" | "updatedAt" | "owner" | "project" | "event">;

/**
 * Post data for updating an existing post
 * Only updatable fields
 */
export type PostUpdateInput = Partial<Pick<PostItem, "title" | "content">>;

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

