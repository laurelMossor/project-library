/**
 * Pure content predicates — safe to import on both client and server.
 *
 * These centralize the "does this draft actually have content?" rule that was
 * previously duplicated as inline booleans in PostPageClient and EventPageClient
 * (and which ignored images in both). Keeping them here means the "a post is
 * valid with any single element" rule lives in exactly one place, shared by the
 * client publish gate, the draft-preservation cleanup, and the server route.
 */

const hasText = (value: string | null | undefined): boolean => Boolean(value && value.trim().length > 0);

/**
 * A post is worth keeping / publishing if it has a title, body, OR at least one photo.
 * Used by: post `canPublish`, post `hasContentRef`, and the server publish gate.
 */
export function postHasContent(fields: {
	title?: string | null;
	content?: string | null;
	imageCount?: number;
}): boolean {
	return hasText(fields.title) || hasText(fields.content) || (fields.imageCount ?? 0) > 0;
}

/**
 * An event draft is worth keeping if any real user-entered field is present.
 * Excludes date (every draft is created with a default `eventDateTime`, so it
 * can't signal user intent) and tags (secondary metadata). Governs draft
 * preservation only — event *publish* rules live elsewhere and are unchanged.
 */
export function eventHasContent(fields: {
	title?: string | null;
	content?: string | null;
	location?: string | null;
	imageCount?: number;
}): boolean {
	return (
		hasText(fields.title) ||
		hasText(fields.content) ||
		hasText(fields.location) ||
		(fields.imageCount ?? 0) > 0
	);
}
