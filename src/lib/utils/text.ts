export const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
};

/**
 * Get initials from a user-like object (firstName, lastName, username).
 * Canonical initials logic lives in card.ts (getCardUserInitials / getCardPageInitials).
 * This is a convenience wrapper for objects with a `username` fallback.
 */
export function getUserInitials(user: { firstName?: string | null; lastName?: string | null; username: string }): string {
	if (user.firstName && user.lastName) {
		return (user.firstName[0] + user.lastName[0]).toUpperCase();
	}
	if (user.firstName) {
		return user.firstName[0].toUpperCase();
	}
	if (user.lastName) {
		return user.lastName[0].toUpperCase();
	}
	return user.username[0].toUpperCase();
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