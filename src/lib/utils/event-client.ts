import { EventItem } from "../types/event";
import { API_EVENTS, API_EVENT } from "../const/routes";

// CLIENT-SIDE FETCH UTILITIES
// These functions fetch from the API routes and can be used in client components

/**
 * Fetch all events with optional search query
 * Client-side utility that calls the /api/events endpoint
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

/**
 * Fetch a single event by ID
 * Client-side utility that calls the /api/events/[id] endpoint
 */
export async function fetchEventById(id: string): Promise<EventItem | null> {
	const res = await fetch(API_EVENT(id));

	if (!res.ok) {
		if (res.status === 404) {
			return null;
		}
		throw new Error("Failed to fetch event");
	}

	return res.json();
}

/**
 * Update an event by ID
 * Client-side utility that calls the PUT /api/events/[id] endpoint
 */
export async function updateEvent(
	id: string,
	data: {
		title?: string;
		description?: string;
		dateTime?: Date;
		location?: string;
		latitude?: number | null;
		longitude?: number | null;
		tags?: string[];
	}
): Promise<EventItem> {
	const res = await fetch(API_EVENT(id), {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			...data,
			dateTime: data.dateTime?.toISOString(),
		}),
	});

	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}));
		throw new Error(errorData.error || "Failed to update event");
	}

	return res.json();
}

/**
 * Delete an event by ID
 * Client-side utility that calls the DELETE /api/events/[id] endpoint
 */
export async function deleteEvent(id: string): Promise<void> {
	const res = await fetch(API_EVENT(id), {
		method: "DELETE",
	});

	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}));
		throw new Error(errorData.error || "Failed to delete event");
	}
}

