// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import type { RsvpItem, RsvpCreateInput, RsvpCountSummary } from "@/lib/types/rsvp";

/**
 * Create or update an RSVP for an event (one RSVP per email per event).
 *
 * Branches explicitly on existence — rather than an upsert + timestamp compare — so `created` is
 * reliable. The activity dispatcher notifies the host only on `created`, so editing an RSVP must
 * not re-notify.
 */
export async function createOrUpdateRsvp(
	eventId: string,
	data: RsvpCreateInput,
): Promise<{ rsvp: RsvpItem; created: boolean }> {
	const email = data.email.trim().toLowerCase();
	const existing = await prisma.rsvp.findUnique({ where: { eventId_email: { eventId, email } } });

	const rsvp = existing
		? await prisma.rsvp.update({
			where: { eventId_email: { eventId, email } },
			data: { name: data.name.trim(), status: data.status },
		})
		: await prisma.rsvp.create({
			data: { eventId, name: data.name.trim(), email, status: data.status },
		});

	return { rsvp, created: !existing };
}

/**
 * Get a single RSVP by eventId + email, or null if none exists.
 */
export async function getRsvpByEmail(eventId: string, email: string): Promise<RsvpItem | null> {
	return prisma.rsvp.findUnique({
		where: {
			eventId_email: {
				eventId,
				email: email.trim().toLowerCase(),
			},
		},
	});
}

/**
 * Get all RSVPs for an event, ordered by most recent first.
 */
export async function getRsvpsByEvent(eventId: string): Promise<RsvpItem[]> {
	return prisma.rsvp.findMany({
		where: { eventId },
		orderBy: { createdAt: "desc" },
	});
}

/**
 * Get aggregate RSVP counts for an event.
 * Uses groupBy to avoid fetching individual records.
 */
export async function getRsvpCounts(eventId: string): Promise<RsvpCountSummary> {
	const counts = await prisma.rsvp.groupBy({
		by: ["status"],
		where: { eventId },
		_count: { status: true },
	});

	const summary: RsvpCountSummary = { going: 0, maybe: 0, cantMakeIt: 0, total: 0 };

	for (const row of counts) {
		const count = row._count.status;
		switch (row.status) {
			case "GOING":
				summary.going = count;
				break;
			case "MAYBE":
				summary.maybe = count;
				break;
			case "CANT_MAKE_IT":
				summary.cantMakeIt = count;
				break;
		}
		summary.total += count;
	}

	return summary;
}
