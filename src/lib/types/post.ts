/**
 * Post type - matches Prisma schema v0.4
 * Can be standalone or attached to Page/Event, or a reply (parentPostId)
 * Posts are owned by User, optionally posted as a Page
 */
export interface PostItem {
	id: string;
	userId: string; // User that created this post
	pageId: string | null; // Optional - if set, posted on behalf of a page
	eventId: string | null; // Optional - if set, this is a descendant post of an event
	parentPostId: string | null; // Optional - if set, this is a reply to another post
	title: string | null; // Optional post title
	content: string; // Post content (required)
	tags: string[];
	topics: string[];
	createdAt: Date;
	updatedAt: Date;
	// Relations (optional, loaded when needed)
	user?: { id: string; username: string; displayName: string | null; firstName: string | null; lastName: string | null; avatarImageId: string | null } | null;
	page?: { id: string; name: string; slug: string; avatarImageId: string | null } | null;
	event?: { id: string; title: string } | null;
}

/**
 * Post data for creating a new post
 * Derived from PostItem, excluding auto-generated fields and userId
 * (userId is handled internally by createPost function)
 * pageId and eventId are optional
 */
export type PostCreateInput = {
	pageId?: string | null;
	eventId?: string | null;
	parentPostId?: string | null;
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
 * Type guard to check if post is an event descendant
 */
export function isEventPost(post: PostItem): post is PostItem & { eventId: string } {
	return post.eventId !== null;
}

/**
 * Type guard to check if post is standalone (no parent)
 */
export function isStandalonePost(post: PostItem): boolean {
	return post.pageId === null && post.eventId === null && post.parentPostId === null;
}
