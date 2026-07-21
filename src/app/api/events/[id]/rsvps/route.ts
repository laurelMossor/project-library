import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { validateRsvpData } from "@/lib/validations";
import { enforceRateLimit } from "@/lib/utils/server/rate-limit";
import { canManageEntity } from "@/lib/utils/server/permission";
import { createOrUpdateRsvp, getRsvpsByEvent } from "@/lib/utils/server/rsvp";
import { getViewerContext, requireViewableEvent } from "@/lib/utils/server/visibility";
import { emitActivity, type EntityRef, type ActorRef } from "@/lib/utils/server/activity";
import { NotificationObject } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/events/:id/rsvps
 * Create or update an RSVP (public, no auth required)
 */
export async function POST(request: Request, { params }: Params) {
	const limited = await enforceRateLimit(request, "rsvp-create", {
		maxRequests: 10,
		windowMs: 60 * 1000,
	});
	if (limited) return limited;

	try {
		const { id } = await params;

		// A viewer who can't see the event (missing / PRIVATE / another owner's draft) 404s BEFORE
		// the published-state check, so a non-owner can't distinguish an unpublished draft (would be
		// 400) from a missing event (404) — closing the draft existence oracle (finding 10).
		const viewer = await getViewerContext();
		const event = await requireViewableEvent(id, viewer);
		if (!event) {
			return notFound("Event not found");
		}

		if (event.status !== "PUBLISHED") {
			return badRequest("RSVPs are only accepted for published events");
		}

		const data = await request.json();
		const validation = validateRsvpData(data);
		if (!validation.valid) {
			return badRequest(validation.error || "Invalid RSVP data");
		}

		const { rsvp, created } = await createOrUpdateRsvp(id, data);

		// Notify the host — only on a NEW rsvp (editing must not re-notify). Prefer the authenticated
		// user; fall back to the guest name. The cast keeps this working before AND after the
		// Rsvp.userId fast-follow lands (today the column is absent, so it's always a guest).
		if (created) {
			const target: EntityRef = event.pageId
				? { type: "PAGE", id: event.pageId }
				: { type: "USER", id: event.userId };
			const rsvpUserId = (rsvp as { userId?: string | null }).userId ?? null;
			const actor: ActorRef = rsvpUserId
				? { type: "USER", id: rsvpUserId }
				: { type: "ANON", label: data.name.trim() };
			await emitActivity("rsvp.created", actor, target, { type: NotificationObject.EVENT, id });
		}

		return NextResponse.json(rsvp, { status: 201 });
	} catch (error) {
		console.error("POST /api/events/:id/rsvps error:", error);
		return serverError("Failed to create RSVP");
	}
}

/**
 * GET /api/events/:id/rsvps
 * List all RSVPs for an event (organizer only)
 */
export async function GET(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { id } = await params;
		const viewer = await getViewerContext();

		// Gate viewability first: a viewer who can't see the event 404s (no existence oracle) before
		// the manage check. The attendee list (names + emails) is then restricted to whoever can
		// manage the event — the creator, or any ADMIN/EDITOR of the hosting page.
		const event = await requireViewableEvent(id, viewer);
		if (!event) {
			return notFound("Event not found");
		}

		const canManage = event.pageId
			? await canManageEntity(ctx.userId, { page: { id: event.pageId } })
			: await canManageEntity(ctx.userId, { user: { id: event.userId } });
		if (!canManage) {
			return NextResponse.json(
				{ error: "Only the event organizer can view the attendee list" },
				{ status: 403 }
			);
		}

		const rsvps = await getRsvpsByEvent(id);
		return NextResponse.json(rsvps);
	} catch (error) {
		console.error("GET /api/events/:id/rsvps error:", error);
		return serverError("Failed to fetch RSVPs");
	}
}
