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
import { canManagePage, getUserPermission, grantPermission } from "./permission";
import { assignableRoles } from "@/lib/const/roles";
import { emitActivity, type EntityRef } from "./activity";

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
 * new member sees the page's connections-only content. Leaving does not unfollow.
 */
export async function addMember(userId: string, pageId: string, role: PermissionRole, tx: Client = prisma) {
  await grantPermission(userId, pageId, ResourceType.PAGE, role, tx);
  await upsertFollow({ type: "USER", id: userId }, { type: "PAGE", id: pageId }, tx);
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
  extra?: { role?: PermissionRole },
) {
  const data = requestWhere(kind, requester, target);
  const existing = await prisma.accessRequest.findFirst({ where: data });
  if (existing) {
    if (extra?.role && existing.role !== extra.role) {
      return prisma.accessRequest.update({ where: { id: existing.id }, data: { role: extra.role } });
    }
    return existing;
  }
  return prisma.accessRequest.create({ data: { ...data, role: extra?.role } });
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
export async function invitePageMember(pageId: string, userId: string, role: PermissionRole): Promise<InviteResult> {
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
    { role },
  );
  await emitActivity("membership.invited", { type: "PAGE", id: pageId }, { type: "USER", id: userId }, { role });
  return { ok: true, status: "invited" };
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
  | { ok: false; reason: "not_found" | "forbidden" };

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
    await addMember(req.requesterId!, req.targetPageId!, PermissionRole.MEMBER, tx);
    return;
  }
  // INVITE: the page asked, the user accepted. Role was stored on the request.
  await addMember(req.targetUserId!, req.requesterPageId!, req.role ?? PermissionRole.MEMBER, tx);
}

/** Approve a request: materialize the edge and delete the request, atomically. */
export async function approveRequest(actorUserId: string, requestId: string): Promise<RequestActResult> {
  const req = await prisma.accessRequest.findUnique({ where: { id: requestId } });
  if (!req) return { ok: false, reason: "not_found" };
  if (!(await canApproveRequest(actorUserId, req))) return { ok: false, reason: "forbidden" };

  await prisma.$transaction(async (tx) => {
    await materialize(req, tx);
    await tx.accessRequest.delete({ where: { id: req.id } });
  });

  // Tell the other side they're in. Fires AFTER the transaction commits. emitActivity never throws.
  if (req.kind === AccessRequestKind.INVITE) {
    // The invitee joined the page — notify the page's managers (NEW_MEMBER).
    await emitActivity(
      "membership.joined",
      { type: "USER", id: req.targetUserId! },
      { type: "PAGE", id: req.requesterPageId! },
    );
  } else {
    const approver: EntityRef = req.targetUserId
      ? { type: "USER", id: req.targetUserId }
      : { type: "PAGE", id: req.targetPageId! };
    const requester: EntityRef = req.requesterId
      ? { type: "USER", id: req.requesterId }
      : { type: "PAGE", id: req.requesterPageId! };
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
