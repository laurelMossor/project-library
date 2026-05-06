import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/utils/server/prisma";
import { canManagePage } from "@/lib/utils/server/permission";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";

type RouteParams = { params: Promise<{ type: string; id: string }> };

/**
 * PATCH /api/profiles/[type]/[id]/about
 *
 * Updates the `aboutContent` field for a User or Page profile.
 * - type = "user": caller must be the user themselves
 * - type = "page": caller must have ADMIN permission on the page
 *
 * Body: { aboutContent: string | null }
 * Response: { aboutContent: string | null }
 */
export async function PATCH(request: Request, { params }: RouteParams) {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return unauthorized();
		}

		const { type, id } = await params;

		if (type !== "user" && type !== "page") {
			return badRequest("Invalid profile type. Must be 'user' or 'page'.");
		}

		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") {
			return badRequest("Invalid request body");
		}

		const { aboutContent } = body as { aboutContent: unknown };
		if (aboutContent !== null && typeof aboutContent !== "string") {
			return badRequest("aboutContent must be a string or null");
		}
		if (typeof aboutContent === "string" && aboutContent.length > 50000) {
			return badRequest("aboutContent must be 50,000 characters or fewer");
		}

		if (type === "user") {
			if (session.user.id !== id) {
				return unauthorized("You can only edit your own About page");
			}
			const updated = await prisma.user.update({
				where: { id },
				data: { aboutContent: aboutContent ?? null },
				select: { aboutContent: true },
			});
			if (!updated) return notFound("User not found");
			return NextResponse.json(updated);
		}

		// type === "page"
		const isAdmin = await canManagePage(session.user.id, id);
		if (!isAdmin) {
			return unauthorized("You do not have permission to manage this page");
		}

		const existing = await prisma.page.findUnique({ where: { id }, select: { id: true } });
		if (!existing) return notFound("Page not found");

		const updated = await prisma.page.update({
			where: { id },
			data: { aboutContent: aboutContent ?? null },
			select: { aboutContent: true },
		});
		return NextResponse.json(updated);
	} catch (error) {
		console.error("PATCH /api/profiles/[type]/[id]/about error:", error);
		return serverError("Failed to update About content");
	}
}
