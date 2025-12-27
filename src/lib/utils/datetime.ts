// Helper to format date and time
// Uses explicit format to avoid hydration mismatches between server and client
export const formatDateTime = (date: Date | string): string => {
	const dateObj = typeof date === 'string' ? new Date(date) : date;
	
	// Use explicit format to ensure server and client render the same
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