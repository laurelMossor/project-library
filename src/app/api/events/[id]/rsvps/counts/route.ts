import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { notFound, serverError } from "@/lib/utils/errors";
import { checkRateLimit, getClientIdentifier } from "@/lib/utils/server/rate-limit";
import { getRsvpCounts } from "@/lib/utils/server/rsvp";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/events/:id/rsvps/counts
 * Get RSVP count summary (public endpoint)
 */
export async function GET(request: Request, { params }: Params) {
	const clientId = getClientIdentifier(request);
	const rateLimit = checkRateLimit(`rsvp-counts:${clientId}`, {
		maxRequests: 60,
		windowMs: 60 * 1000,
	});

	if (!rateLimit.allowed) {
		return NextResponse.json(
			{ error: "Too many requests. Please try again later." },
			{ status: 429 }
		);
	}

	try {
		const { id } = await params;

		// Verify event exists
		const event = await prisma.event.findUnique({
			where: { id },
			select: { id: true },
		});

		if (!event) {
			return notFound("Event not found");
		}

		const counts = await getRsvpCounts(id);
		return NextResponse.json(counts);
	} catch (error) {
		console.error("GET /api/events/:id/rsvps/counts error:", error);
		return serverError("Failed to fetch RSVP counts");
	}
}
