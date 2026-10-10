import { EventItem } from "../types/event";
import { API_EVENTS } from "../const/routes";

// CLIENT-SIDE FETCH UTILITIES for views that still fetch on the client (Explore).
// Event and RSVP saves are Server Actions in src/lib/actions/.

/**
 * Fetch all events with optional search query (public)
 */
export async function fetchEvents(search?: string): Promise<EventItem[]> {
	const url = search
		? `${API_EVENTS}?search=${encodeURIComponent(search)}`
		: API_EVENTS;

	const res = await fetch(url);

	if (!res.ok) {
		throw new Error("Failed to fetch events");
	}

	return res.json();
}
