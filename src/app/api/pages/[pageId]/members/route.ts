import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { canManagePage, getResourcePermissions } from "@/lib/utils/server/permission";
import { getViewerContext, requireViewableProfile } from "@/lib/utils/server/visibility";
import { invitePageMember, listPageEmailInvites, listPageInvites } from "@/lib/utils/server/requests";
import { PermissionRole, ResourceType } from "@prisma/client";

type RouteParams = { params: Promise<{ pageId: string }> };

const ASSIGNABLE = new Set<string>(Object.values(PermissionRole));

/**
 * GET /api/pages/[pageId]/members
 * List members. A page ADMIN also sees pending invites, each flagged `pending: true` — including
 * invites sent by email, listed by address until accepted (`kind: "email"`, no `user`).
 */
export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { pageId } = await params;
		const viewer = await getViewerContext();
		if (!(await requireViewableProfile("PAGE", pageId, viewer))) {
			return notFound("Page not found");
		}
		const permissions = await getResourcePermissions(pageId, ResourceType.PAGE);
		const members = permissions.map((p) => ({ ...p, pending: false }));

		const isAdmin = viewer.userId ? await canManagePage(viewer.userId, pageId) : false;
		if (!isAdmin) return NextResponse.json(members);

		const [invites, emailInvites] = await Promise.all([listPageInvites(pageId), listPageEmailInvites(pageId)]);
		// An invite that went out by email is listed by its email row only (see listPageEmailInvites).
		const sentByEmail = new Set(emailInvites.map((inv) => inv.claimedUserId).filter(Boolean));
		const pending = invites
			.filter((inv) => inv.targetUser && !sentByEmail.has(inv.targetUserId))
			.map((inv) => ({
				id: inv.id,
				userId: inv.targetUserId,
				role: inv.role,
				pending: true,
				user: inv.targetUser,
				createdAt: inv.createdAt,
			}));

		// Invites sent by email: shown by address (never the profile), cancelled via the email-invites route.
		const pendingEmail = emailInvites.map((inv) => ({
			id: inv.id,
			kind: "email" as const,
			email: inv.email,
			role: inv.role,
			pending: true,
			createdAt: inv.createdAt,
		}));

		return NextResponse.json([...members, ...pending, ...pendingEmail]);
	} catch (error) {
		console.error("GET /api/pages/[pageId]/members error:", error);
		return serverError("Failed to fetch members");
	}
}

/**
 * POST /api/pages/[pageId]/members
 * Invite someone to a role. They must accept; nothing is granted here.
 * Protected endpoint (requires ADMIN permission).
 */
export async function POST(request: Request, { params }: RouteParams) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();

		const { pageId } = await params;
		if (!(await canManagePage(ctx.userId, pageId))) {
			return unauthorized("You do not have permission to manage this page");
		}

		const data = await request.json();
		const { userId, role } = data;

		if (!userId || !role) return badRequest("userId and role are required");
		if (!ASSIGNABLE.has(role)) return badRequest("Invalid role");

		const result = await invitePageMember(pageId, userId, role);
		if (!result.ok) {
			if (result.reason === "not_found") return notFound("Page not found");
			if (result.reason === "user_not_found") return badRequest("User not found");
			if (result.reason === "already_member") return badRequest("That person already has a role on this page");
			return badRequest("That role isn't available for this page");
		}

		return NextResponse.json({ status: "invited" }, { status: 201 });
	} catch (error) {
		console.error("POST /api/pages/[pageId]/members error:", error);
		return serverError("Failed to invite member");
	}
}
