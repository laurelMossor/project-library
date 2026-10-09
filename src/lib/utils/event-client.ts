import { EventItem } from "../types/event";
import { API_EVENTS, API_EVENT_RSVPS, API_EVENT_RSVP_COUNTS } from "../const/routes";
import type { RsvpItem, RsvpCreateInput, RsvpCountSummary, RsvpStatus } from "../types/rsvp";
import { authFetch } from "./auth-client";

// CLIENT-SIDE FETCH UTILITIES for views that still fetch on the client (Explore, RSVP).
// Event saves are Server Actions in src/lib/actions/event.ts; RSVP moves there in Phase 2.
// Authenticated endpoints use authFetch (throws AuthError on 401). Public endpoints use plain fetch.

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
 * Create or update an RSVP for an event (public; session cookie links member identity server-side)
 */
export async function createRsvp(
	eventId: string,
	data: RsvpCreateInput | { status: RsvpStatus; guests?: { name?: string }[] },
): Promise<RsvpItem> {
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
