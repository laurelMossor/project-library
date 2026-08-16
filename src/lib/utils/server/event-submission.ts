// ⚠️ SERVER-ONLY: Poster Catcher submission queries
// Do not import in client components! The staging store is read/written only by the
// superadmin review surface + the Telegram intake pipeline.

import { prisma } from "./prisma";
import type { EventSubmission, EventSubmissionStatus } from "@prisma/client";
import { parseFutureEventDate } from "../event-date";

/** A submission plus its poster image url, as the review surface consumes it. */
export type SubmissionWithImage = EventSubmission & { rawImage: { url: string } | null };

// Non-terminal states the review queue shows. PUBLISHED/REJECTED are closed out.
const OPEN_STATUSES: EventSubmissionStatus[] = ["PENDING", "READY", "NEEDS_FIX", "FAILED"];

/** Fields the operator may edit in review. All optional; date is ISO string or null. */
export type SubmissionEdits = {
	title?: string | null;
	content?: string | null;
	eventDate?: string | null;
	eventTimezone?: string | null;
	location?: string | null;
	tags?: string[];
};

/** List open (non-terminal) submissions, newest first, with poster image url. */
export async function listOpenSubmissions(): Promise<SubmissionWithImage[]> {
	return prisma.eventSubmission.findMany({
		where: { status: { in: OPEN_STATUSES } },
		include: { rawImage: { select: { url: true } } },
		orderBy: { submittedAt: "desc" },
	});
}

export async function getSubmissionById(id: string): Promise<SubmissionWithImage | null> {
	return prisma.eventSubmission.findUnique({
		where: { id },
		include: { rawImage: { select: { url: true } } },
	});
}

/**
 * Apply operator edits and recompute status from the date gate: a valid future date →
 * READY, otherwise NEEDS_FIX. Never touches terminal rows (PUBLISHED/REJECTED). This is
 * how a NEEDS_FIX/FAILED near-miss becomes materializable once a date is filled in.
 */
export async function applySubmissionEdits(id: string, edits: SubmissionEdits): Promise<SubmissionWithImage | null> {
	const current = await prisma.eventSubmission.findUnique({ where: { id }, select: { status: true } });
	if (!current) return null;
	if (current.status === "PUBLISHED" || current.status === "REJECTED") return getSubmissionById(id);

	const hasDateEdit = edits.eventDate !== undefined;
	const { date, isFuture } = parseFutureEventDate(edits.eventDate);

	// Recompute status only when the date changed; otherwise keep the current open status.
	const status: EventSubmissionStatus | undefined = hasDateEdit ? (isFuture ? "READY" : "NEEDS_FIX") : undefined;

	await prisma.eventSubmission.update({
		where: { id },
		data: {
			...(edits.title !== undefined ? { title: edits.title } : {}),
			...(edits.content !== undefined ? { content: edits.content } : {}),
			...(hasDateEdit ? { eventDate: isFuture ? date : null } : {}),
			...(edits.eventTimezone !== undefined ? { eventTimezone: edits.eventTimezone } : {}),
			...(edits.location !== undefined ? { location: edits.location } : {}),
			...(edits.tags !== undefined ? { tags: edits.tags } : {}),
			...(status ? { status } : {}),
			...(hasDateEdit && !isFuture
				? { errorNote: "No valid future date — add one to publish." }
				: status === "READY"
					? { errorNote: null }
					: {}),
		},
	});
	return getSubmissionById(id);
}

/** Mark a submission rejected (terminal). */
export async function rejectSubmission(id: string): Promise<void> {
	await prisma.eventSubmission.update({
		where: { id },
		data: { status: "REJECTED", reviewedAt: new Date() },
	});
}

/** Mark a submission published (terminal) after the operator materialized the Event. */
export async function markSubmissionPublished(id: string, publishedEventId: string): Promise<void> {
	await prisma.eventSubmission.update({
		where: { id },
		data: { status: "PUBLISHED", publishedEventId, reviewedAt: new Date() },
	});
}
