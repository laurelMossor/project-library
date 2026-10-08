// ⚠️ SERVER-ONLY: Request-to-Follow / Request-to-Join / role-invite choke point
//
// The single place that opens a pending request and that materializes an approved
// one into the real grant (Follow / Permission). Routes stay thin and never branch
// on visibility or membership policy themselves.
//
// Model note: a pending request lives only in `AccessRequest`. Approval creates
// the edge and deletes the request in one transaction; denial deletes it. The
// grant tables (Follow / Permission) therefore always mean "granted" — which is
// what the visibility layer reads.

import { prisma } from "./prisma";
import { AccessRequestKind, MembershipPolicy, PermissionRole, ProfileVisibility, ResourceType } from "@prisma/client";
import { canManagePage, getUserPermission, grantPermission, revokePermission } from "./permission";
import { assignableRoles } from "@/lib/const/roles";
import { emitActivity, type EntityRef } from "./activity";
import { createSignupInvite } from "./signup-invite";
import { normalizeEmail, validateEmail } from "@/lib/validations";
import { EMAIL_INVITE_DAILY_CAP, EMAIL_INVITE_NOTE_MAX } from "@/lib/const/email-invites";

type TargetRef = EntityRef & { profileVisibility: ProfileVisibility };

/** Prisma client or a $transaction client. */
type Client = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ---------------------------------------------------------------------------
// Field mappers — turn an EntityRef into the polymorphic columns.
// ---------------------------------------------------------------------------
function followEdgeData(requester: EntityRef, target: EntityRef) {
  return {
    followerId: requester.type === "USER" ? requester.id : null,
    followerPageId: requester.type === "PAGE" ? requester.id : null,
    followingUserId: target.type === "USER" ? target.id : null,
    followingPageId: target.type === "PAGE" ? target.id : null,
  };
}

function requestWhere(kind: AccessRequestKind, requester: EntityRef, target: EntityRef) {
  return {
    kind,
    requesterId: requester.type === "USER" ? requester.id : null,
    requesterPageId: requester.type === "PAGE" ? requester.id : null,
    targetUserId: target.type === "USER" ? target.id : null,
    targetPageId: target.type === "PAGE" ? target.id : null,
  };
}

/**
 * Idempotent follow. Creating a page and gaining a role both follow the page;
 * a second call (re-approve, already following) is a no-op.
 */
export async function upsertFollow(requester: EntityRef, target: EntityRef, tx: Client = prisma) {
  const data = followEdgeData(requester, target);
  const existing = await tx.follow.findFirst({ where: data, select: { id: true } });
  if (!existing) await tx.follow.create({ data });
}

/**
 * The one place a page role is created: the permission row, plus a follow so the
 * new member sees the page's connections-only content. Voluntary leave does not
 * unfollow. Admin-remove (`removeMember`) drops both.
 */
export async function addMember(userId: string, pageId: string, role: PermissionRole, tx: Client = prisma) {
  await grantPermission(userId, pageId, ResourceType.PAGE, role, tx);
  await upsertFollow({ type: "USER", id: userId }, { type: "PAGE", id: pageId }, tx);
}

/**
 * Admin-remove: drop the role and the user's follow of the page together.
 * A follow is enough to keep seeing a private page, so revoking the role alone
 * would leave that access in place. The follow row is the same whether
 * membership created it or the person followed first, so both go.
 * Voluntary leave does not call this.
 */
export async function removeMember(userId: string, pageId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await revokePermission(userId, pageId, ResourceType.PAGE, tx);
    await tx.follow.deleteMany({
      where: { followerId: userId, followingPageId: pageId },
    });
  });
}

/** Does `userId` have a pending FOLLOW request to `target`? (Drives the "Requested" button state.) */
export async function hasPendingFollowRequest(userId: string, target: EntityRef): Promise<boolean> {
  const where = requestWhere(AccessRequestKind.FOLLOW, { type: "USER", id: userId }, target);
  return (await prisma.accessRequest.findFirst({ where, select: { id: true } })) !== null;
}

/** Does `userId` have a pending JOIN request to `pageId`? */
export async function hasPendingJoinRequest(userId: string, pageId: string): Promise<boolean> {
  const where = requestWhere(AccessRequestKind.JOIN, { type: "USER", id: userId }, { type: "PAGE", id: pageId });
  return (await prisma.accessRequest.findFirst({ where, select: { id: true } })) !== null;
}

/** Cancel the requester's own pending FOLLOW request to `target`. Returns true if one was removed. */
export async function cancelFollowRequest(userId: string, target: EntityRef): Promise<boolean> {
  const where = requestWhere(AccessRequestKind.FOLLOW, { type: "USER", id: userId }, target);
  const { count } = await prisma.accessRequest.deleteMany({ where });
  return count > 0;
}

/** Cancel the user's own pending JOIN request to `pageId`. Returns true if one was removed. */
export async function cancelJoinRequest(userId: string, pageId: string): Promise<boolean> {
  const where = requestWhere(AccessRequestKind.JOIN, { type: "USER", id: userId }, { type: "PAGE", id: pageId });
  const { count } = await prisma.accessRequest.deleteMany({ where });
  return count > 0;
}

/** Create the pending request, or return the existing one (idempotent re-request). */
async function upsertAccessRequest(
  kind: AccessRequestKind,
  requester: EntityRef,
  target: EntityRef,
  extra?: { role?: PermissionRole; note?: string | null },
) {
  const data = requestWhere(kind, requester, target);
  const existing = await prisma.accessRequest.findFirst({ where: data });
  if (existing) {
    // A re-invite refreshes the offered role, and the note when one is sent.
    const roleChanged = !!extra?.role && existing.role !== extra.role;
    const noteChanged = !!extra?.note && existing.note !== extra.note;
    if (roleChanged || noteChanged) {
      return prisma.accessRequest.update({
        where: { id: existing.id },
        data: { ...(roleChanged && { role: extra!.role }), ...(noteChanged && { note: extra!.note }) },
      });
    }
    return existing;
  }
  return prisma.accessRequest.create({ data: { ...data, role: extra?.role, note: extra?.note ?? null } });
}

// ---------------------------------------------------------------------------
// Create-or-request — the single visibility / policy branch point.
// ---------------------------------------------------------------------------

/**
 * Follow `target`, or open a pending FOLLOW request when `target` is PRIVATE.
 * Caller has already validated existence / not-self / not-already-following.
 */
export async function requestOrCreateFollow(
  requester: EntityRef,
  target: TargetRef,
): Promise<{ status: "followed" | "requested" }> {
  // BLOCK-SEAM: a future isBlocked(requester, target) check goes here.
  if (target.profileVisibility !== ProfileVisibility.PRIVATE) {
    await upsertFollow(requester, target);
    await emitActivity("follow.created", requester, target);
    return { status: "followed" };
  }
  await upsertAccessRequest(AccessRequestKind.FOLLOW, requester, target);
  await emitActivity("follow.requested", requester, target);
  return { status: "requested" };
}

export type JoinPageResult = { status: "requested" } | { status: "unavailable" };

/**
 * Open a pending JOIN request. Only a REQUEST_TO_JOIN page accepts one; every
 * other policy is "unavailable" so the route can 404 (no existence leak, and no
 * instant-join — membership is never granted without an admin).
 */
export async function requestToJoinPage(
  userId: string,
  page: { id: string; membershipPolicy: MembershipPolicy },
): Promise<JoinPageResult> {
  if (page.membershipPolicy !== MembershipPolicy.REQUEST_TO_JOIN) {
    return { status: "unavailable" };
  }
  const requester: EntityRef = { type: "USER", id: userId };
  const target: EntityRef = { type: "PAGE", id: page.id };
  await upsertAccessRequest(AccessRequestKind.JOIN, requester, target);
  await emitActivity("membership.requested", requester, target);
  return { status: "requested" };
}

export type InviteResult =
  | { ok: true; status: "invited" }
  | { ok: false; reason: "not_found" | "user_not_found" | "invalid_role" | "already_member" };

/**
 * Invite `userId` to `role` on `pageId`. The invitee must accept; nothing is
 * granted here. Re-inviting the same person updates the offered role.
 * MEMBER is only offered when the page's policy is not CLOSED.
 */
export async function invitePageMember(
  pageId: string,
  userId: string,
  role: PermissionRole,
  note?: string | null,
): Promise<InviteResult> {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { id: true, membershipPolicy: true },
  });
  if (!page) return { ok: false, reason: "not_found" };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return { ok: false, reason: "user_not_found" };

  if (!assignableRoles(page.membershipPolicy).includes(role)) {
    return { ok: false, reason: "invalid_role" };
  }

  const existing = await getUserPermission(userId, pageId, ResourceType.PAGE);
  if (existing) return { ok: false, reason: "already_member" };

  await upsertAccessRequest(
    AccessRequestKind.INVITE,
    { type: "PAGE", id: pageId },
    { type: "USER", id: userId },
    { role, note },
  );
  await emitActivity("membership.invited", { type: "PAGE", id: pageId }, { type: "USER", id: userId }, { role });
  return { ok: true, status: "invited" };
}

// ---------------------------------------------------------------------------
// Invite by email — reaches people who may not have an account yet.
//
// Every address becomes a PageEmailInvite row (the durable send log + daily cap). An address that
// already has an account is claimed at once into the normal AccessRequest INVITE above; any other
// address gets a signup token and stays pending until an account with that email is created
// (claimPageEmailInvites, called from signup). The result never says which addresses had accounts.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

export type EmailInviteResult =
  | {
      ok: true;
      /** Addresses that became an invite (in-app or signup email). */
      sent: number;
      /** Addresses without an account: the caller emails each a signup link. */
      signupInvites: { email: string; rawToken: string }[];
      /**
       * Addresses that already belong to a member of this page. Nothing was created for them.
       * Naming them is safe: it says the address matches a current member, not which other
       * addresses have accounts.
       */
      alreadyMembers: string[];
      page: { id: string; name: string };
    }
  | { ok: false; reason: "not_found" | "invalid_role" | "no_emails" | "invalid_emails" }
  | { ok: false; reason: "over_cap"; remaining: number };

export async function invitePageMembersByEmail(args: {
  pageId: string;
  inviterId: string;
  emails: string[];
  role: PermissionRole;
  note?: string | null;
}): Promise<EmailInviteResult> {
  const page = await prisma.page.findUnique({
    where: { id: args.pageId },
    select: { id: true, name: true, membershipPolicy: true },
  });
  if (!page) return { ok: false, reason: "not_found" };
  if (!assignableRoles(page.membershipPolicy).includes(args.role)) {
    return { ok: false, reason: "invalid_role" };
  }

  const emails = [...new Set(args.emails.map(normalizeEmail))].filter(Boolean);
  if (emails.length === 0) return { ok: false, reason: "no_emails" };
  if (!emails.every(validateEmail)) return { ok: false, reason: "invalid_emails" };
  const note = args.note?.trim().slice(0, EMAIL_INVITE_NOTE_MAX) || null;

  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  });
  const userIdByEmail = new Map(users.map((u) => [u.email, u.id]));

  // Someone who already has a role is not invited again: no row, no email, no bell, and
  // they don't spend a slot of the daily cap. Checked before the write so a no-op batch
  // never touches the invite table.
  const alreadyMembers: string[] = [];
  const toInvite: string[] = [];
  for (const email of emails) {
    const userId = userIdByEmail.get(email);
    const existing = userId ? await getUserPermission(userId, page.id, ResourceType.PAGE) : null;
    if (existing) alreadyMembers.push(email);
    else toInvite.push(email);
  }

  const pageInfo = { id: page.id, name: page.name };
  if (toInvite.length === 0) {
    return { ok: true, sent: 0, signupInvites: [], alreadyMembers, page: pageInfo };
  }

  // Cap check + rows in one transaction (DB writes only — no notifications in here, so a
  // rollback can't leave a stray bell). Two concurrent batches can overshoot slightly under
  // READ COMMITTED; acceptable for an anti-spam cap.
  const rows = await prisma.$transaction(async (tx) => {
    const used = await tx.pageEmailInvite.count({
      where: { invitedById: args.inviterId, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
    });
    if (used + toInvite.length > EMAIL_INVITE_DAILY_CAP) {
      return { remaining: Math.max(0, EMAIL_INVITE_DAILY_CAP - used) };
    }
    // A newer send to the same address supersedes the older row (one email row per page+address).
    await tx.pageEmailInvite.updateMany({
      where: { pageId: page.id, email: { in: toInvite }, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });
    return tx.pageEmailInvite.createManyAndReturn({
      data: toInvite.map((email) => ({
        pageId: page.id,
        invitedById: args.inviterId,
        email,
        role: args.role,
        note,
      })),
      select: { id: true, pageId: true, email: true, role: true, note: true },
    });
  });
  if (!Array.isArray(rows)) return { ok: false, reason: "over_cap", remaining: rows.remaining };

  const signupInvites: { email: string; rawToken: string }[] = [];
  let sent = 0;
  for (const row of rows) {
    const userId = userIdByEmail.get(row.email);
    if (userId) {
      const outcome = await claimEmailInvite(row, userId);
      // Joined between the check above and this claim: drop the row we just wrote.
      if (outcome === "already_member") alreadyMembers.push(row.email);
      else if (outcome === "claimed") sent += 1;
    } else {
      const { rawToken } = await createSignupInvite(row.email);
      signupInvites.push({ email: row.email, rawToken });
      sent += 1;
    }
  }

  return { ok: true, sent, signupInvites, alreadyMembers, page: pageInfo };
}

type EmailInviteRow = { id: string; pageId: string; role: PermissionRole; note: string | null };

/**
 * Turn a pending email invite into the real AccessRequest INVITE for `userId` (which notifies them).
 * If the page can no longer offer the role, or they already have one, the row is cancelled.
 */
async function claimEmailInvite(
  row: EmailInviteRow,
  userId: string,
): Promise<"claimed" | "already_member" | "cancelled"> {
  const result = await invitePageMember(row.pageId, userId, row.role, row.note);
  if (!result.ok && result.reason === "already_member") {
    await prisma.pageEmailInvite.update({
      where: { id: row.id },
      data: { cancelledAt: new Date() },
    });
    return "already_member";
  }
  await prisma.pageEmailInvite.update({
    where: { id: row.id },
    data: result.ok ? { claimedAt: new Date(), claimedUserId: userId } : { cancelledAt: new Date() },
  });
  return result.ok ? "claimed" : "cancelled";
}

/**
 * A new account was created for `email`: open every page invite waiting on that address.
 * Idempotent (claimed rows are skipped; invitePageMember upserts). Safe to key on email because
 * signup requires a token that was mailed to that address.
 */
export async function claimPageEmailInvites(userId: string, email: string): Promise<void> {
  const rows = await prisma.pageEmailInvite.findMany({
    where: { email: normalizeEmail(email), claimedAt: null, cancelledAt: null },
    select: { id: true, pageId: true, role: true, note: true },
    orderBy: { createdAt: "asc" },
  });
  for (const row of rows) {
    await claimEmailInvite(row, userId);
  }
}

/**
 * Pending email invites a page has sent, oldest first. An invite sent by email stays an email row
 * until it's accepted — even once claimed for an account (at send time or at signup) — so the
 * admin's list never reveals which addresses have accounts. `claimedUserId` is for the members
 * route to hide the matching profile invite; never send it to the client.
 */
export async function listPageEmailInvites(pageId: string) {
  const pendingInvites = await prisma.accessRequest.findMany({
    where: { requesterPageId: pageId, kind: AccessRequestKind.INVITE },
    select: { targetUserId: true },
  });
  const pendingUserIds = pendingInvites.map((r) => r.targetUserId).filter((id): id is string => !!id);
  return prisma.pageEmailInvite.findMany({
    where: {
      pageId,
      cancelledAt: null,
      OR: [{ claimedAt: null }, { claimedUserId: { in: pendingUserIds } }],
    },
    select: { id: true, email: true, role: true, createdAt: true, claimedUserId: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Cancel a page's pending email invite. If it was already claimed for an account, the open
 * AccessRequest INVITE is withdrawn too. The caller has checked canManagePage.
 */
export async function cancelPageEmailInvite(pageId: string, inviteId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.pageEmailInvite.findFirst({
      where: { id: inviteId, pageId, cancelledAt: null },
      select: { id: true, claimedUserId: true },
    });
    if (!row) return false;
    await tx.pageEmailInvite.update({ where: { id: row.id }, data: { cancelledAt: new Date() } });
    if (row.claimedUserId) {
      await tx.accessRequest.deleteMany({
        where: { kind: AccessRequestKind.INVITE, requesterPageId: pageId, targetUserId: row.claimedUserId },
      });
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Listing — for the admin/owner pending-requests surfaces.
// ---------------------------------------------------------------------------

const requesterUserSelect = {
  id: true,
  handle: true,
  displayName: true,
  avatarImageId: true,
  avatarImage: { select: { url: true } },
} as const;

const requesterPageSelect = {
  id: true,
  handle: true,
  name: true,
  avatarImageId: true,
  avatarImage: { select: { url: true } },
} as const;

/** Pending requests targeting a page (JOIN + any page-FOLLOW), oldest first. Invites are not here. */
export function listPageRequests(pageId: string) {
  return prisma.accessRequest.findMany({
    where: { targetPageId: pageId },
    include: {
      requester: { select: requesterUserSelect },
      requesterPage: { select: requesterPageSelect },
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Pending FOLLOW requests targeting a user, oldest first. Invites are a different list. */
export function listIncomingFollowRequests(userId: string) {
  return prisma.accessRequest.findMany({
    where: { targetUserId: userId, kind: AccessRequestKind.FOLLOW },
    include: {
      requester: { select: requesterUserSelect },
      requesterPage: { select: requesterPageSelect },
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Role invitations waiting on this user, oldest first. */
export function listMyInvites(userId: string) {
  return prisma.accessRequest.findMany({
    where: { targetUserId: userId, kind: AccessRequestKind.INVITE },
    include: { requesterPage: { select: requesterPageSelect } },
    orderBy: { createdAt: "asc" },
  });
}

/** Pending invitations this page has sent, oldest first. */
export function listPageInvites(pageId: string) {
  return prisma.accessRequest.findMany({
    where: { requesterPageId: pageId, kind: AccessRequestKind.INVITE },
    include: { targetUser: { select: requesterUserSelect } },
    orderBy: { createdAt: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Approve / deny — who may act depends on the kind.
// ---------------------------------------------------------------------------

export type RequestActResult =
  | { ok: true; status: "approved" | "denied" }
  | { ok: false; reason: "not_found" | "forbidden" | "unavailable" };

type RequestRow = {
  id: string;
  kind: AccessRequestKind;
  role: PermissionRole | null;
  requesterId: string | null;
  requesterPageId: string | null;
  targetUserId: string | null;
  targetPageId: string | null;
};

/**
 * Who may approve. FOLLOW/JOIN: the target (the user themselves, or a page ADMIN).
 * INVITE: the invitee only — a page admin can send an invite but cannot accept it.
 */
async function canApproveRequest(actorUserId: string, req: RequestRow): Promise<boolean> {
  if (req.kind === AccessRequestKind.INVITE) return req.targetUserId === actorUserId;
  if (req.targetUserId) return req.targetUserId === actorUserId;
  if (req.targetPageId) return canManagePage(actorUserId, req.targetPageId);
  return false;
}

/**
 * Who may deny. Same as approve, plus a page ADMIN may cancel (deny) the page's
 * own outgoing INVITE. The invitee declines; the admin cancels.
 */
async function canDenyRequest(actorUserId: string, req: RequestRow): Promise<boolean> {
  if (await canApproveRequest(actorUserId, req)) return true;
  if (req.kind === AccessRequestKind.INVITE && req.requesterPageId) {
    return canManagePage(actorUserId, req.requesterPageId);
  }
  return false;
}

/** Materialize an approved request's edge inside a transaction. */
async function materialize(req: RequestRow, tx: Client) {
  if (req.kind === AccessRequestKind.FOLLOW) {
    const requester: EntityRef = req.requesterId
      ? { type: "USER", id: req.requesterId }
      : { type: "PAGE", id: req.requesterPageId! };
    const target: EntityRef = req.targetUserId
      ? { type: "USER", id: req.targetUserId }
      : { type: "PAGE", id: req.targetPageId! };
    await upsertFollow(requester, target, tx);
    return;
  }
  if (req.kind === AccessRequestKind.JOIN) {
    // A higher role already granted (an accepted invite) must not be overwritten with MEMBER.
    const existing = await getUserPermission(req.requesterId!, req.targetPageId!, ResourceType.PAGE, tx);
    if (!existing) {
      await addMember(req.requesterId!, req.targetPageId!, PermissionRole.MEMBER, tx);
    }
    return;
  }
  // INVITE: the page asked, the user accepted. The caller has re-checked the role
  // against the page's current policy. Drop a leftover JOIN so it cannot demote later.
  await addMember(req.targetUserId!, req.requesterPageId!, req.role!, tx);
  await tx.accessRequest.deleteMany({
    where: {
      kind: AccessRequestKind.JOIN,
      requesterId: req.targetUserId,
      targetPageId: req.requesterPageId,
    },
  });
}

/**
 * Approve a request: materialize the edge and delete the request, atomically.
 * An invite is re-read inside the transaction. If the page's policy no longer
 * allows that role, the invite is deleted and nothing is granted.
 */
export async function approveRequest(actorUserId: string, requestId: string): Promise<RequestActResult> {
  const req = await prisma.accessRequest.findUnique({ where: { id: requestId } });
  if (!req) return { ok: false, reason: "not_found" };
  if (!(await canApproveRequest(actorUserId, req))) return { ok: false, reason: "forbidden" };

  const granted = await prisma.$transaction(async (tx) => {
    const current = await tx.accessRequest.findUnique({ where: { id: requestId } });
    if (!current) return null;

    if (current.kind === AccessRequestKind.INVITE) {
      const page = await tx.page.findUnique({
        where: { id: current.requesterPageId! },
        select: { membershipPolicy: true },
      });
      const role = current.role;
      if (!page || !role || !assignableRoles(page.membershipPolicy).includes(role)) {
        await tx.accessRequest.delete({ where: { id: current.id } });
        return "unavailable" as const;
      }
    }

    await materialize(current, tx);
    await tx.accessRequest.delete({ where: { id: current.id } });
    return current;
  });

  if (granted === "unavailable") return { ok: false, reason: "unavailable" };
  if (!granted) return { ok: false, reason: "not_found" };

  // Tell the other side they're in. Fires AFTER the transaction commits. emitActivity never throws.
  if (granted.kind === AccessRequestKind.INVITE) {
    // The invitee joined the page — notify the page's managers (NEW_MEMBER).
    await emitActivity(
      "membership.joined",
      { type: "USER", id: granted.targetUserId! },
      { type: "PAGE", id: granted.requesterPageId! },
    );
  } else {
    const approver: EntityRef = granted.targetUserId
      ? { type: "USER", id: granted.targetUserId }
      : { type: "PAGE", id: granted.targetPageId! };
    const requester: EntityRef = granted.requesterId
      ? { type: "USER", id: granted.requesterId }
      : { type: "PAGE", id: granted.requesterPageId! };
    await emitActivity("request.approved", approver, requester);
  }

  return { ok: true, status: "approved" };
}

/** Deny a request: delete it. Re-requesting later is allowed. */
export async function denyRequest(actorUserId: string, requestId: string): Promise<RequestActResult> {
  const req = await prisma.accessRequest.findUnique({ where: { id: requestId } });
  if (!req) return { ok: false, reason: "not_found" };
  if (!(await canDenyRequest(actorUserId, req))) return { ok: false, reason: "forbidden" };

  await prisma.accessRequest.delete({ where: { id: req.id } });
  return { ok: true, status: "denied" };
}

/**
 * When an entity flips PRIVATE → PUBLIC, the reason to gate *follows* is gone:
 * materialize every pending FOLLOW targeting it, then drop those rows.
 *
 * JOIN and INVITE are deliberately left alone. Auto-accepting JOINs belongs to a
 * future flip to membership policy OPEN, not to a visibility unlock.
 */
export async function autoApprovePendingOnUnlock(entity: EntityRef, tx: Client = prisma): Promise<void> {
  const target = entity.type === "USER" ? { targetUserId: entity.id } : { targetPageId: entity.id };
  const where = { ...target, kind: AccessRequestKind.FOLLOW };
  const pending = await tx.accessRequest.findMany({ where });
  for (const req of pending) {
    await materialize(req, tx);
  }
  if (pending.length > 0) {
    await tx.accessRequest.deleteMany({ where });
  }
}
