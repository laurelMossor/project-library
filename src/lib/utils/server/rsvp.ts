// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import { getUserById, publicUserEmbedFields } from "./user";
import { DomainError } from "./domain-error";
import { requireViewableEvent, viewerContextFor } from "./visibility";
import { emitActivity, type EntityRef, type ActorRef } from "./activity";
import { validateRsvpData } from "@/lib/validations";
import { getUserDisplayName } from "@/lib/types/user";
import { NotificationObject } from "@prisma/client";
import type { RsvpItem, RsvpCreateInput, RsvpCountSummary, RsvpStatus } from "@/lib/types/rsvp";

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

/**
 * Submit an RSVP for a published event the viewer can see (members and anonymous guests alike).
 * A member's name/email come from their account, never the client, and record `userId`; an
 * anonymous submission can't touch an RSVP that belongs to a member account. Refusals throw
 * DomainError. Notifies the host only on a NEW RSVP — editing must not re-notify.
 */
export async function submitRsvp(
	userId: string | null,
	eventId: string,
	input: { status: RsvpStatus; name?: string; email?: string; guests?: RsvpCreateInput["guests"] },
): Promise<RsvpItem> {
	// A viewer who can't see the event (missing / PRIVATE / another owner's draft) gets not_found BEFORE
	// the published-state check, so a non-owner can't tell an unpublished draft from a missing event.
	const viewer = userId ? await viewerContextFor(userId) : { userId: null, memberPageIds: [] };
	const event = await requireViewableEvent(eventId, viewer);
	if (!event) throw new DomainError("Event not found", "not_found");
	if (event.status !== "PUBLISHED") throw new DomainError("RSVPs are only accepted for published events");

	let data: RsvpCreateInput;
	if (userId) {
		const user = await getUserById(userId);
		if (!user) throw new DomainError("Please log in to continue.", "unauthorized");
		data = { name: getUserDisplayName(user), email: user.email, status: input.status, guests: input.guests };
	} else {
		data = { name: input.name as string, email: input.email as string, status: input.status, guests: input.guests };
	}

	const validation = validateRsvpData(data);
	if (!validation.valid) throw new DomainError(validation.error || "Invalid RSVP data");

	if (!userId) {
		const existing = await getRsvpByEmail(eventId, data.email);
		if (existing?.userId) {
			throw new DomainError("This RSVP belongs to a member account. Sign in to change it.", "forbidden");
		}
	}

	const { rsvp, created } = await createOrUpdateRsvp(eventId, data, { userId });

	if (created) {
		const target: EntityRef = event.asPageId
			? { type: "PAGE", id: event.asPageId }
			: { type: "USER", id: event.userId };
		const actor: ActorRef = rsvp.userId
			? { type: "USER", id: rsvp.userId }
			: { type: "ANON", label: data.name.trim() };
		await emitActivity("rsvp.created", actor, target, { type: NotificationObject.EVENT, id: eventId });
	}

	return rsvp;
}
