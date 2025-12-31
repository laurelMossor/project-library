import { PublicUser } from "../types/user";

export const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
};

// Helper to get user initials for profile placeholder
export const getInitials = (user: PublicUser): string => {
	if (user.name) {
		const parts = user.name.trim().split(/\s+/);
		if (parts.length >= 2) {
			return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
		}
		return user.name[0].toUpperCase();
	}
	return user.username[0].toUpperCase();
};

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