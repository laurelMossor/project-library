import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { validateRsvpData } from "@/lib/validations";
import { enforceRateLimit } from "@/lib/utils/server/rate-limit";
import { createOrUpdateRsvp, getRsvpsByEvent } from "@/lib/utils/server/rsvp";

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

		// Verify event exists and is published
		const event = await prisma.event.findUnique({
			where: { id },
			select: { id: true, status: true },
		});

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

		const rsvp = await createOrUpdateRsvp(id, data);
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

		// Verify event exists and user is the organizer
		const event = await prisma.event.findUnique({
			where: { id },
			select: { userId: true },
		});

		if (!event) {
			return notFound("Event not found");
		}

		if (event.userId !== ctx.userId) {
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
