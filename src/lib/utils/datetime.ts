/** Wall-clock event time in the stored IANA timezone (e.g. America/Los_Angeles). */
export const formatDateTime = (date: Date | string, timezone: string): string => {
	const dateObj = typeof date === "string" ? new Date(date) : date;

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
};

/**
 * Absolute calendar date for an instant, in the viewer's local timezone.
 * Client-only — pair with `<LocalDate>` so SSR never renders a localized string.
 */
export const formatInstantAbsolute = (date: Date | string): string => {
	const dateObj = typeof date === "string" ? new Date(date) : date;
	const month = dateObj.toLocaleString("en-US", { month: "short" });
	const day = dateObj.getDate();
	const year = dateObj.getFullYear();
	return `${month} ${day}, ${year}`;
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
	return formatInstantAbsolute(then);
};
