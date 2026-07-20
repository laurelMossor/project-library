// Uses explicit format to avoid hydration mismatches between server and client
export const formatDateTime = (date: Date | string, timezone?: string | null): string => {
	const dateObj = typeof date === 'string' ? new Date(date) : date;

	if (timezone) {
		const formatted = dateObj.toLocaleString("en-US", {
			timeZone: timezone,
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		});

		const tzAbbr = new Intl.DateTimeFormat("en-US", {
			timeZone: timezone,
			timeZoneName: "short",
		}).formatToParts(dateObj).find(p => p.type === "timeZoneName")?.value ?? "";

		return `${formatted} ${tzAbbr}`;
	}

	const month = dateObj.toLocaleString("en-US", { month: "short" });
	const day = dateObj.getDate();
	const year = dateObj.getFullYear();
	const hour = dateObj.getHours();
	const minute = dateObj.getMinutes();
	const ampm = hour >= 12 ? 'PM' : 'AM';
	const displayHour = hour % 12 || 12;
	const displayMinute = minute.toString().padStart(2, '0');

	return `${month} ${day}, ${year} at ${displayHour}:${displayMinute} ${ampm}`;
};

/**
 * Short relative time for recent activity ("Just now", "5m ago", "3h ago", "2d ago"),
 * falling back to an absolute date past a week. Client-only (reads `now`) — call it from
 * effects/rendered lists, not SSR, to avoid hydration mismatch.
 */
export const formatRelativeTime = (date: Date | string): string => {
	const then = typeof date === "string" ? new Date(date) : date;
	const diffMs = new Date().getTime() - then.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	return then.toLocaleDateString();
};
