import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/utils/server/superadmin";
import {
	getSubmissionById,
	applySubmissionEdits,
	rejectSubmission,
	markSubmissionPublished,
	type SubmissionEdits,
} from "@/lib/utils/server/event-submission";
import { badRequest, forbidden, notFound, serverError } from "@/lib/utils/errors";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/submissions/[id]
 * Superadmin-only. One of three actions:
 *   - { action: "edit", fields }        → apply operator edits (recomputes READY/NEEDS_FIX from date)
 *   - { action: "reject" }              → terminal REJECTED
 *   - { action: "publish", eventId }    → terminal PUBLISHED (after the client materialized the Event)
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const ctx = await requireSuperAdmin();
	if (!ctx) return forbidden();

	const { id } = await params;

	const existing = await getSubmissionById(id);
	if (!existing) return notFound("Submission not found");

	let body: { action?: string; fields?: SubmissionEdits; eventId?: string };
	try {
		body = await request.json();
	} catch {
		return badRequest("Invalid JSON body");
	}

	try {
		switch (body.action) {
			case "edit": {
				const updated = await applySubmissionEdits(id, body.fields ?? {});
				return NextResponse.json(updated);
			}
			case "reject": {
				await rejectSubmission(id);
				return NextResponse.json(await getSubmissionById(id));
			}
			case "publish": {
				if (!body.eventId || typeof body.eventId !== "string") {
					return badRequest("eventId is required to mark a submission published");
				}
				await markSubmissionPublished(id, body.eventId);
				return NextResponse.json(await getSubmissionById(id));
			}
			default:
				return badRequest("Unknown action (expected edit | reject | publish)");
		}
	} catch (error) {
		console.error("PATCH /api/admin/submissions/[id] error:", error);
		return serverError("Failed to update submission");
	}
}
