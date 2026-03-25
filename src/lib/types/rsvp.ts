/**
 * RSVP types — derived from Prisma schema
 * RSVPs are anonymous (no userId) — attendees provide name + email only.
 */

export type RsvpStatus = "GOING" | "MAYBE" | "CANT_MAKE_IT";

export interface RsvpItem {
	id: string;
	eventId: string;
	name: string;
	email: string;
	status: RsvpStatus;
	createdAt: Date;
	updatedAt: Date;
}

export interface RsvpCreateInput {
	name: string;
	email: string;
	status: RsvpStatus;
}

export interface RsvpCountSummary {
	going: number;
	maybe: number;
	cantMakeIt: number;
	total: number;
}
