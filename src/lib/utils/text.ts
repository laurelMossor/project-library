export const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
};

/**
 * Poster Catcher: append a trailing "Original source: {url}" line to an event description.
 * Idempotent — if the exact line is already present it isn't added twice. Used at extraction
 * (to bake the source into the editable content) and on operator hand-fill of a link-only
 * capture. Returns `content` unchanged when there's no source url.
 */
export function withSourceLine(content: string | null | undefined, sourceUrl: string | null | undefined): string {
	const base = (content ?? "").trimEnd();
	if (!sourceUrl) return base;
	const line = `Original source: ${sourceUrl}`;
	if (base.includes(line)) return base;
	return base ? `${base}\n\n${line}` : line;
}

/** Poster Catcher community-share disclaimer. Baked into editable event content. */
export const POSTER_CATCHER_DISCLAIMER =
	"This listing was shared on The Project Library as a community post. We didn't organize this event and aren't affiliated with the hosts. Details can change; confirm with the original source before you go.";

/**
 * Poster Catcher: append the community-share disclaimer to an event description.
 * Idempotent; used at extraction and on operator hand-fill. Always appended
 * (unlike withSourceLine, which is URL-gated). Compose as
 * withSourceLine(withDisclaimer(content), sourceUrl) so the source line stays last.
 */
export function withDisclaimer(content: string | null | undefined): string {
	const base = (content ?? "").trimEnd();
	if (base.includes(POSTER_CATCHER_DISCLAIMER)) return base;
	return base ? `${base}\n\n${POSTER_CATCHER_DISCLAIMER}` : POSTER_CATCHER_DISCLAIMER;
}

/**
 * Get initials from a user-like object (firstName, lastName, handle).
 * Canonical initials logic lives in card.ts (getCardUserInitials / getCardPageInitials).
 * This is a convenience wrapper for objects with a `handle` fallback.
 */
export function getUserInitials(user: { firstName?: string | null; lastName?: string | null; handle: string }): string {
	if (user.firstName && user.lastName) {
		return (user.firstName[0] + user.lastName[0]).toUpperCase();
	}
	if (user.firstName) {
		return user.firstName[0].toUpperCase();
	}
	if (user.lastName) {
		return user.lastName[0].toUpperCase();
	}
	return user.handle[0].toUpperCase();
}

/**
 * Get initials from a page/entity name.
 * Two-word names → first letter of each word. Single word → first 2-3 chars.
 */
export function getPageInitials(name: string): string {
	const words = name.trim().split(/\s+/);
	if (words.length >= 2) {
		return (words[0][0] + words[1][0]).toUpperCase();
	}
	const word = words[0];
	if (word.length >= 3) return word.substring(0, 3).toUpperCase();
	return word.substring(0, 2).toUpperCase();
}

export function getPathDisplayName(path: string): string {
	// Remove leading slash and capitalize first letter
	const cleaned = path.replace(/^\//, "");
	if (!cleaned) return "Home";
	
	// Handle user profile paths (e.g., /u/username)
	if (cleaned.startsWith("u/")) {
		return "User Profile";
	}
	
	// Capitalize first letter and replace hyphens with spaces
	return cleaned
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}