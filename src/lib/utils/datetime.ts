// Helper to format date and time
export const formatDateTime = (date: Date | string): string => {
	const dateObj = typeof date === 'string' ? new Date(date) : date;
	return dateObj.toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
};