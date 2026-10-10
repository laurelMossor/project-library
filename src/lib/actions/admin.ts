"use server";

import { authedAction, requireId } from "@/lib/utils/server/action";
import { DomainError } from "@/lib/utils/server/domain-error";
import { assertSuperAdmin } from "@/lib/utils/server/superadmin";
import {
	applySubmissionEdits,
	materializeSubmission,
	rejectSubmission,
} from "@/lib/utils/server/event-submission";
import type { SubmissionEdits } from "@/lib/types/event-submission";

// Poster Catcher review (superadmin only, re-checked here as well as in the /admin layout). The
// open-submissions list is server-rendered, so the wrapper's refresh updates or drops the row.

const notFound = () => new DomainError("Submission not found", "not_found");

/** Persist operator edits without materializing (recomputes READY/NEEDS_FIX from the date). */
export const saveSubmissionEditsAction = authedAction(async (ctx, input: { id: string; fields: SubmissionEdits }) => {
	assertSuperAdmin(ctx.userId);
	if (!(await applySubmissionEdits(requireId(input?.id, "submission"), input.fields ?? {}))) throw notFound();
});

/** Reject a submission (terminal). */
export const rejectSubmissionAction = authedAction(async (ctx, input: { id: string }) => {
	assertSuperAdmin(ctx.userId);
	if (!(await rejectSubmission(requireId(input?.id, "submission")))) throw notFound();
});

/**
 * Finalize an approved submission against the Event the operator just created: attach the poster
 * server-side and mark it PUBLISHED, idempotently, so any superadmin can approve.
 */
export const publishSubmissionAction = authedAction(async (ctx, input: { id: string; eventId: string }) => {
	assertSuperAdmin(ctx.userId);
	const published = await materializeSubmission(requireId(input?.id, "submission"), requireId(input?.eventId, "event"));
	if (!published) throw notFound();
});
