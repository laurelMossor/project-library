import { Event } from "../types/event";

// CLIENT-SIDE FETCH UTILITIES
// These functions fetch from the API routes and can be used in client components

/**
 * Fetch all events with optional search query
 * Client-side utility that calls the /api/events endpoint
 */
export async function fetchEvents(search?: string): Promise<Event[]> {
	const url = search 
		? `/api/events?search=${encodeURIComponent(search)}` 
		: "/api/events";
	
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
export async function fetchEventById(id: string): Promise<Event | null> {
	const res = await fetch(`/api/events/${id}`);

	if (!res.ok) {
		if (res.status === 404) {
			return null;
		}
		throw new Error("Failed to fetch event");
	}

	return res.json();
}

