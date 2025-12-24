export const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
};

// Helper to get user initials for profile placeholder
export const getInitials = (name: string | null, username: string): string => {
	if (name) {
		const parts = name.trim().split(/\s+/);
		if (parts.length >= 2) {
			return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
		}
		return name[0].toUpperCase();
	}
	return username[0].toUpperCase();
};