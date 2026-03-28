import { EventItem } from "../types/event";
import { API_EVENTS, API_EVENT, API_EVENT_RSVPS, API_EVENT_RSVP_COUNTS } from "../const/routes";
import type { RsvpItem, RsvpCreateInput, RsvpCountSummary } from "../types/rsvp";
import { authFetch } from "./auth-client";

// CLIENT-SIDE FETCH UTILITIES
// These functions fetch from the API routes and can be used in client components
// Authenticated endpoints use authFetch (throws AuthError on 401).
// Public endpoints use plain fetch.

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

/**
 * Fetch a single event by ID (public for published events)
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
 * Update an event by ID (authenticated)
 */
export async function updateEvent(
	id: string,
	data: {
		title?: string;
		content?: string;
		eventDateTime?: Date;
		location?: string;
		latitude?: number | null;
		longitude?: number | null;
		tags?: string[];
		status?: string;
		pageId?: string | null;
	}
): Promise<EventItem> {
	const res = await authFetch(API_EVENT(id), {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			...data,
			eventDateTime: data.eventDateTime?.toISOString(),
		}),
	});

	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}));
		throw new Error(errorData.error || "Failed to update event");
	}

	return res.json();
}

/**
 * Publish an event (change status from DRAFT to PUBLISHED)
 */
export async function publishEvent(id: string): Promise<EventItem> {
	return updateEvent(id, { status: "PUBLISHED" });
}

/**
 * Create a draft event for inline editing (authenticated)
 */
export async function createDraftEvent(pageId?: string): Promise<EventItem> {
	const res = await authFetch(API_EVENTS, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ isDraft: true, ...(pageId ? { pageId } : {}) }),
	});

	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}));
		throw new Error(errorData.error || "Failed to create draft event");
	}

	return res.json();
}

/**
 * Create or update an RSVP for an event (public, no auth required)
 */
export async function createRsvp(eventId: string, data: RsvpCreateInput): Promise<RsvpItem> {
	const res = await fetch(API_EVENT_RSVPS(eventId), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});

	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}));
		throw new Error(errorData.error || "Failed to submit RSVP");
	}

	return res.json();
}

/**
 * Fetch RSVP counts for an event (public)
 */
export async function fetchRsvpCounts(eventId: string): Promise<RsvpCountSummary> {
	const res = await fetch(API_EVENT_RSVP_COUNTS(eventId));

	if (!res.ok) {
		throw new Error("Failed to fetch RSVP counts");
	}

	return res.json();
}

/**
 * Fetch all RSVPs for an event (organizer only, authenticated)
 */
export async function fetchRsvps(eventId: string): Promise<RsvpItem[]> {
	const res = await authFetch(API_EVENT_RSVPS(eventId));

	if (!res.ok) {
		throw new Error("Failed to fetch RSVPs");
	}

	return res.json();
}

/**
 * Delete an event by ID (authenticated)
 */
export async function deleteEvent(id: string): Promise<void> {
	const res = await authFetch(API_EVENT(id), {
		method: "DELETE",
	});

	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}));
		throw new Error(errorData.error || "Failed to delete event");
	}
}
