import { NextResponse, after } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { canManagePage } from "@/lib/utils/server/permission";
import { invitePageMembersByEmail } from "@/lib/utils/server/requests";
import { SIGNUP_INVITE_TTL_DAYS } from "@/lib/utils/server/signup-invite";
import { sendPageInviteEmails } from "@/lib/utils/server/email/emails";
import { absoluteUrl } from "@/lib/utils/server/url";
import { logAction } from "@/lib/utils/server/log";
import { prisma } from "@/lib/utils/server/prisma";
import { getUserDisplayName } from "@/lib/types/user";
import { SIGNUP_WITH_INVITE } from "@/lib/const/routes";
import { EMAIL_INVITE_DAILY_CAP, EMAIL_INVITE_NOTE_MAX } from "@/lib/const/email-invites";
import { PermissionRole } from "@prisma/client";

type RouteParams = { params: Promise<{ pageId: string }> };

const ASSIGNABLE = new Set<string>(Object.values(PermissionRole));

/**
 * POST /api/pages/[pageId]/email-invites  { emails: string[], role, note? }
 * Invite people to a role by email. Addresses with an account get the normal in-app invite;
 * the rest get a signup link and their invite waits for them. Page ADMIN only.
 * The response names addresses that already have a role. It does not say which other addresses had accounts.
 */
export async function POST(request: Request, { params }: RouteParams) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();

		const { pageId } = await params;
		if (!(await canManagePage(ctx.userId, pageId))) {
			return unauthorized("You do not have permission to manage this page");
		}

		const { emails, role, note } = await request.json();
		if (!Array.isArray(emails) || !emails.every((e) => typeof e === "string")) {
			return badRequest("emails must be a list of addresses");
		}
		if (typeof role !== "string" || !ASSIGNABLE.has(role)) return badRequest("Invalid role");
		if (note != null && typeof note !== "string") return badRequest("Invalid note");
		if (typeof note === "string" && note.trim().length > EMAIL_INVITE_NOTE_MAX) {
			return badRequest(`Keep the note under ${EMAIL_INVITE_NOTE_MAX} characters`);
		}

		const result = await invitePageMembersByEmail({
			pageId,
			inviterId: ctx.userId,
			emails,
			role: role as PermissionRole,
			note,
		});

		if (!result.ok) {
			switch (result.reason) {
				case "not_found":
					return notFound("Page not found");
				case "invalid_role":
					return badRequest("That role isn't available for this page");
				case "no_emails":
					return badRequest("Add at least one email address");
				case "invalid_emails":
					return badRequest("Some of those email addresses aren't valid");
				case "over_cap":
					return NextResponse.json(
						{
							error: `You can send up to ${EMAIL_INVITE_DAILY_CAP} email invites a day. You have ${result.remaining} left today.`,
							remaining: result.remaining,
						},
						{ status: 429 },
					);
			}
		}

		if (result.signupInvites.length > 0) {
			const inviter = await prisma.user.findUnique({
				where: { id: ctx.userId },
				select: { displayName: true, firstName: true, lastName: true, handle: true },
			});
			const inviterName = inviter ? getUserDisplayName(inviter) : "Someone";
			const trimmedNote = typeof note === "string" ? note.trim() || null : null;
			const { page, signupInvites } = result;
			// Send after responding: the invites already exist, so a provider hiccup must not fail the request.
			after(async () => {
				const sent = await sendPageInviteEmails(
					signupInvites.map(({ email, rawToken }) => ({
						to: email,
						inviterName,
						pageName: page.name,
						role,
						note: trimmedNote,
						url: absoluteUrl(SIGNUP_WITH_INVITE(rawToken)),
						expiresInDays: SIGNUP_INVITE_TTL_DAYS,
					})),
				);
				if (!sent.ok) {
					logAction("page_invite.email_failed", ctx.userId, {
						pageId,
						count: signupInvites.length,
						error: sent.error,
					});
				}
			});
		}

		logAction("page_invite.email_sent", ctx.userId, {
			pageId,
			count: result.sent,
			alreadyMembers: result.alreadyMembers.length,
			role,
		});
		return NextResponse.json(
			{ status: "invited", sent: result.sent, alreadyMembers: result.alreadyMembers },
			{ status: 201 },
		);
	} catch (error) {
		console.error("POST /api/pages/[pageId]/email-invites error:", error);
		return serverError("Failed to send invites");
	}
}
