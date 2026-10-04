import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, serverError, badRequest, notFound } from "@/lib/utils/errors";
import {
	getUserPermission,
	revokePermission,
	isSelfServiceRole,
	wouldRemoveLastAdmin,
} from "@/lib/utils/server/permission";
import { requestToJoinPage, hasPendingJoinRequest, cancelJoinRequest } from "@/lib/utils/server/requests";
import { ResourceType, PermissionRole } from "@prisma/client";

type RouteParams = { params: Promise<{ pageId: string }> };

/**
 * GET /api/pages/[pageId]/membership
 * Returns the current user's role on the page, or null if unauthenticated / not a member.
 */
export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { pageId } = await params;
		const ctx = await getSessionContext();
		if (!ctx) {
			return NextResponse.json({ role: null });
		}

		const role = await getUserPermission(ctx.userId, pageId, ResourceType.PAGE);
		const requested = role ? false : await hasPendingJoinRequest(ctx.userId, pageId);
		return NextResponse.json({ role, requested });
	} catch (error) {
		console.error("GET /api/pages/[pageId]/membership error:", error);
		return serverError("Failed to fetch membership");
	}
}

/**
 * POST /api/pages/[pageId]/membership
 * Ask to join. Only a REQUEST_TO_JOIN page accepts this; every other policy 404s.
 * Returns 400 if the user already holds ADMIN or EDITOR (no self-downgrade).
 */
export async function POST(_request: Request, { params }: RouteParams) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();

		const { pageId } = await params;
		const page = await prisma.page.findUnique({
			where: { id: pageId },
			select: { id: true, membershipPolicy: true },
		});
		if (!page) return notFound("Page not found");

		const existing = await getUserPermission(ctx.userId, pageId, ResourceType.PAGE);

		// Privileged roles can't self-downgrade through the join flow.
		if (!isSelfServiceRole(existing)) {
			return badRequest("You already have a role on this page");
		}

		if (existing === PermissionRole.MEMBER) {
			return NextResponse.json({ role: PermissionRole.MEMBER });
		}

		const result = await requestToJoinPage(ctx.userId, page);
		if (result.status === "unavailable") return notFound("Page not found");
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		console.error("POST /api/pages/[pageId]/membership error:", error);
		return serverError("Failed to join page");
	}
}

/**
 * DELETE /api/pages/[pageId]/membership
 * Self-service leave for ANY role. The only guard: the last admin can't leave
 * (it would orphan the page) — they must hand off admin first.
 * Leaving does not unfollow the page.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();

		const { pageId } = await params;
		const existing = await getUserPermission(ctx.userId, pageId, ResourceType.PAGE);

		if (!existing) {
			await cancelJoinRequest(ctx.userId, pageId);
			return NextResponse.json({ success: true });
		}

		if (await wouldRemoveLastAdmin(pageId, ctx.userId)) {
			return badRequest("You are the last admin — assign another admin before leaving");
		}

		await revokePermission(ctx.userId, pageId, ResourceType.PAGE);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("DELETE /api/pages/[pageId]/membership error:", error);
		return serverError("Failed to leave page");
	}
}
