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
