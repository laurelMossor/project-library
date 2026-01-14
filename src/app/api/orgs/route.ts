import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createOrg } from "@/lib/utils/server/org";
import { validateOrgData } from "@/lib/validations";
import { badRequest, unauthorized } from "@/lib/utils/errors";

/**
 * POST /api/orgs
 * Create a new organization
 * Protected endpoint (requires authentication)
 */
export async function POST(request: Request) {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const data = await request.json();
	const { name, slug, headline, bio, interests, location } = data;

	try {
		// Process interests: normalize to array, trim, and filter empty values
		let processedInterests: string[] = [];
		if (interests) {
			if (typeof interests === "string") {
				processedInterests = interests.split(",").map((s: string) => s.trim()).filter(Boolean);
			} else if (Array.isArray(interests)) {
				processedInterests = interests.map((s: unknown) => (typeof s === "string" ? s.trim() : String(s).trim())).filter(Boolean);
			}
		}

		// Validate org data
		const validation = validateOrgData({
			name,
			slug,
			headline,
			bio,
			interests: processedInterests.length > 0 ? processedInterests : undefined,
			location,
		});

		if (!validation.valid) {
			return badRequest(validation.error || "Invalid org data");
		}

		const org = await createOrg(session.user.id, {
			name: name.trim(),
			slug: slug.trim(),
			headline: headline?.trim() || undefined,
			bio: bio?.trim() || undefined,
			interests: processedInterests.length > 0 ? processedInterests : undefined,
			location: location?.trim() || undefined,
		});

		return NextResponse.json(org, { status: 201 });
	} catch (error) {
		console.error("Error creating org:", error);
		if (error instanceof Error && error.message.includes("already exists")) {
			return badRequest("An organization with this slug already exists");
		}
		return badRequest("Failed to create organization");
	}
}
