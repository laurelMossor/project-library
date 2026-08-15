// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import { publicUserEmbedFields } from "./user";
import type { RsvpItem, RsvpCreateInput, RsvpCountSummary } from "@/lib/types/rsvp";

const rsvpWithGuestsSelect = {
	include: {
		guests: true,
		user: { select: publicUserEmbedFields },
	},
} as const;

function normalizeGuests(
	status: RsvpCreateInput["status"],
	guests: RsvpCreateInput["guests"],
): { name: string | null }[] {
	if (status !== "GOING") return [];
	if (!guests?.length) return [];
	const guest = guests[0];
	const trimmed = guest.name?.trim();
	return [{ name: trimmed && trimmed.length > 0 ? trimmed : null }];
}

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
	options?: { userId?: string | null },
): Promise<{ rsvp: RsvpItem; created: boolean }> {
	const email = data.email.trim().toLowerCase();
	const existing = await prisma.rsvp.findUnique({
		where: { eventId_email: { eventId, email } },
	});

	const userId = options?.userId ?? existing?.userId ?? null;

	const { rsvp, created } = await prisma.$transaction(async (tx) => {
		const row = existing
			? await tx.rsvp.update({
				where: { eventId_email: { eventId, email } },
				data: {
					name: data.name.trim(),
					status: data.status,
					userId,
				},
			})
			: await tx.rsvp.create({
				data: {
					eventId,
					name: data.name.trim(),
					email,
					status: data.status,
					userId,
				},
			});

		await tx.rsvpGuest.deleteMany({ where: { rsvpId: row.id } });
		const normalized = normalizeGuests(data.status, data.guests);
		if (normalized.length > 0) {
			await tx.rsvpGuest.createMany({
				data: normalized.map((g) => ({ rsvpId: row.id, name: g.name })),
			});
		}

		const withGuests = await tx.rsvp.findUniqueOrThrow({
			where: { id: row.id },
			include: { guests: true, user: { select: publicUserEmbedFields } },
		});

		return { rsvp: withGuests as RsvpItem, created: !existing };
	});

	return { rsvp, created };
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
		...rsvpWithGuestsSelect,
	}) as Promise<RsvpItem | null>;
}

/**
 * Get all RSVPs for an event, ordered by most recent first.
 */
export async function getRsvpsByEvent(eventId: string): Promise<RsvpItem[]> {
	return prisma.rsvp.findMany({
		where: { eventId },
		orderBy: { createdAt: "desc" },
		...rsvpWithGuestsSelect,
	}) as Promise<RsvpItem[]>;
}

/**
 * Get aggregate RSVP counts for an event.
 * goingTotal = GOING host RSVPs + their plus-ones; MAYBE is shown but never counted toward capacity.
 */
export async function getRsvpCounts(eventId: string): Promise<RsvpCountSummary> {
	const [counts, guestCount] = await Promise.all([
		prisma.rsvp.groupBy({
			by: ["status"],
			where: { eventId },
			_count: { status: true },
		}),
		prisma.rsvpGuest.count({
			where: { rsvp: { eventId, status: "GOING" } },
		}),
	]);

	const summary: RsvpCountSummary = {
		going: 0,
		maybe: 0,
		cantMakeIt: 0,
		total: 0,
		guests: guestCount,
		goingTotal: 0,
	};

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

	summary.goingTotal = summary.going + summary.guests;

	return summary;
}
