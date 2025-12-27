import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createEvent, GetAllEventsOptions, getAllEvents } from "@/lib/utils/event";
import { unauthorized, badRequest } from "@/lib/utils/errors";
import { validateEventData } from "@/lib/validations";

function parseNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

// GET /api/events - list events with optional search/pagination
export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const search = searchParams.get("search") || undefined;
	const limit = parseNumber(searchParams.get("limit"));
	const offset = parseNumber(searchParams.get("offset"));

	try {
		const options: GetAllEventsOptions = {
			search,
			limit: typeof limit === "number" && limit > 0 ? limit : undefined,
			offset: typeof offset === "number" && offset >= 0 ? offset : undefined,
		};
		const events = await getAllEvents(options);
		return NextResponse.json(events);
	} catch (error) {
		console.error("Error fetching events:", error);
		return badRequest("Failed to fetch events");
	}
}

// POST /api/events - create a new event
export async function POST(request: Request) {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const data = await request.json();
	const parsedLatitude = parseNumber(data?.latitude);
	const parsedLongitude = parseNumber(data?.longitude);
	const dateTime = data?.dateTime ? new Date(data.dateTime) : null;

	if (!dateTime) {
		return badRequest("Event date is required");
	}

	const validation = validateEventData({
		title: data?.title,
		description: data?.description,
		dateTime,
		location: data?.location,
		latitude: parsedLatitude ?? undefined,
		longitude: parsedLongitude ?? undefined,
		tags: Array.isArray(data?.tags) ? data.tags : undefined,
			imageUrls: Array.isArray(data?.imageUrls) ? data.imageUrls : undefined,
	});

	if (!validation.valid) {
		return badRequest(validation.error || "Invalid event data");
	}

	try {
		const trimmedTitle = (data.title as string).trim();
		const trimmedDescription = (data.description as string).trim();
		const trimmedLocation = (data.location as string).trim();
		const tags =
			Array.isArray(data.tags) && data.tags.length > 0
				? data.tags
						.map((tag: unknown) => (typeof tag === "string" ? tag.trim() : String(tag).trim()))
						.filter((tag: string) => tag.length > 0)
				: undefined;
		const imageUrls =
			Array.isArray(data.imageUrls) && data.imageUrls.length > 0
				? data.imageUrls
						.map((url: unknown) => (typeof url === "string" ? url.trim() : String(url).trim()))
						.filter((url: string) => url.length > 0)
				: undefined;

		const event = await createEvent(session.user.id, {
			title: trimmedTitle,
			description: trimmedDescription,
			dateTime,
			location: trimmedLocation,
			latitude: parsedLatitude ?? null,
			longitude: parsedLongitude ?? null,
			tags,
			imageUrls,
		});

		return NextResponse.json(event, { status: 201 });
	} catch (error) {
		console.error("Error creating event:", error);
		return badRequest("Failed to create event");
	}
}

