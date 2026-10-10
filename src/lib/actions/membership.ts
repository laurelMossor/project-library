"use server";

import { authedAction, requireId } from "@/lib/utils/server/action";
import {
	cancelEmailInvite,
	changeMemberRole,
	inviteMember,
	joinPage,
	leavePage,
	removePageMember,
	resolveRequest,
} from "@/lib/utils/server/requests";
import { inviteByEmail, type EmailInviteOutcome } from "@/lib/utils/server/page-invite";

// Page membership, invites, and join/follow requests. The Connections lists and the page's
// Join button are server-rendered, so the wrapper's refresh is what puts a change on screen.

/** Page ADMIN: invite someone to a role (re-inviting updates the offered role). */
export const inviteMemberAction = authedAction(async (ctx, input: { pageId: string; userId: string; role: string }) => {
	await inviteMember(ctx.userId, requireId(input?.pageId, "page"), requireId(input?.userId, "user"), input.role);
});

/** Page ADMIN: change an existing member's role. */
export const changeMemberRoleAction = authedAction(
	async (ctx, input: { pageId: string; userId: string; role: string }) => {
		await changeMemberRole(ctx.userId, requireId(input?.pageId, "page"), requireId(input?.userId, "user"), input.role);
	},
);

/** Page ADMIN: remove a member from the page. */
export const removeMemberAction = authedAction(async (ctx, input: { pageId: string; userId: string }) => {
	await removePageMember(ctx.userId, requireId(input?.pageId, "page"), requireId(input?.userId, "user"));
});

/** Page ADMIN: invite people by email. Signup links go out after the response. */
export const inviteByEmailAction = authedAction(
	async (
		ctx,
		input: { pageId: string; emails: string[]; role: string; note?: string | null },
	): Promise<EmailInviteOutcome> => inviteByEmail(ctx.userId, requireId(input?.pageId, "page"), input),
);

/** Page ADMIN: cancel a pending email invite. */
export const cancelEmailInviteAction = authedAction(async (ctx, input: { pageId: string; inviteId: string }) => {
	await cancelEmailInvite(ctx.userId, requireId(input?.pageId, "page"), requireId(input?.inviteId, "invite"));
});

/** Ask to join a page. */
export const joinPageAction = authedAction(async (ctx, input: { pageId: string }) => {
	await joinPage(ctx.userId, requireId(input?.pageId, "page"));
});

/** Leave a page, or withdraw a pending join request. */
export const leavePageAction = authedAction(async (ctx, input: { pageId: string }) => {
	await leavePage(ctx.userId, requireId(input?.pageId, "page"));
});

/** Accept a request: a follow request on you or your page, a join request, or an invite to you. */
export const approveRequestAction = authedAction(async (ctx, input: { requestId: string }) => {
	await resolveRequest(ctx.userId, requireId(input?.requestId, "request"), "approve");
});

/** Decline a request, or cancel an invite your page sent. */
export const denyRequestAction = authedAction(async (ctx, input: { requestId: string }) => {
	await resolveRequest(ctx.userId, requireId(input?.requestId, "request"), "deny");
});
