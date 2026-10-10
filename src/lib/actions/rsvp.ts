"use server";

import { publicAction, requireId } from "@/lib/utils/server/action";
import { submitRsvp } from "@/lib/utils/server/rsvp";
import type { RsvpCreateInput, RsvpStatus } from "@/lib/types/rsvp";

// The counts and the organizer's attendee list are server-rendered on the event page, so the
// wrapper's refresh is what puts a new or changed RSVP on screen.

/**
 * RSVP to an event. Anyone may (anonymous guests send name + email); a signed-in member's
 * identity comes from the session, so any name/email they send is ignored.
 */
export const submitRsvpAction = publicAction(
	async (ctx, input: { eventId: string; status: RsvpStatus; name?: string; email?: string; guests?: RsvpCreateInput["guests"] }) => {
		const rsvp = await submitRsvp(ctx?.userId ?? null, requireId(input?.eventId, "event"), input);
		return { status: rsvp.status };
	},
	{ rateLimit: { key: "rsvp-create", maxRequests: 10, windowMs: 60 * 1000 } },
);
