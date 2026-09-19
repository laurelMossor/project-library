/**
 * RSVP types — derived from Prisma schema
 * Anonymous path: name + email (userId null). Authenticated members record userId.
 */

import type { CardUser } from "./card";

export type RsvpStatus = "GOING" | "MAYBE" | "CANT_MAKE_IT";

export interface RsvpGuestItem {
	id: string;
	name: string | null;
}

export interface RsvpItem {
	id: string;
	eventId: string;
	userId: string | null;
	name: string;
	email: string;
	status: RsvpStatus;
	guests: RsvpGuestItem[];
	/** Present when userId is set — attribution-only embed for admin attendee list. */
	user?: CardUser | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface RsvpCreateInput {
	name: string;
	email: string;
	status: RsvpStatus;
	/** At most one plus-one (enforced in validation). */
	guests?: { name?: string }[];
}

export interface RsvpCountSummary {
	going: number;
	maybe: number;
	cantMakeIt: number;
	/** Host RSVPs only (excludes plus-ones). */
	total: number;
	/** Plus-ones attached to GOING host RSVPs. */
	guests: number;
	/** Capacity headcount: GOING hosts + their plus-ones. */
	goingTotal: number;
}
