// ⚠️ SERVER-ONLY: Request-to-Follow / Request-to-Join choke point
//
// The single place that decides "instant edge vs pending request" and that
// materializes an approved request into the real grant (Follow / Permission).
// Routes stay thin and never branch on visibility themselves.
//
// Model note: a pending request lives only in `AccessRequest`. Approval creates
// the edge and deletes the request in one transaction; denial deletes it. The
// grant tables (Follow / Permission) therefore always mean "granted" — which is
// what the visibility layer reads.

import { prisma } from "./prisma";
import { AccessRequestKind, PermissionRole, ResourceType, ProfileVisibility } from "@prisma/client";
import { canManagePage, grantPermission } from "./permission";
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
async function upsertAccessRequest(kind: AccessRequestKind, requester: EntityRef, target: EntityRef) {
  const data = requestWhere(kind, requester, target);
  const existing = await prisma.accessRequest.findFirst({ where: data });
  return existing ?? prisma.accessRequest.create({ data });
}

// ---------------------------------------------------------------------------
// Create-or-request — the single visibility branch point.
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
    await prisma.follow.create({ data: followEdgeData(requester, target) });
    emitActivity("follow.created", requester, target);
    return { status: "followed" };
  }
  await upsertAccessRequest(AccessRequestKind.FOLLOW, requester, target);
  emitActivity("follow.requested", requester, target);
  return { status: "requested" };
}

/**
 * Grant MEMBER on `page`, or open a pending JOIN request when `page` is PRIVATE.
 * JOIN is user→page only. Caller has confirmed the user holds no privileged role.
 */
export async function requestOrJoinPage(
  userId: string,
  page: { id: string; profileVisibility: ProfileVisibility },
): Promise<{ status: "joined" | "requested"; role?: PermissionRole }> {
  const requester: EntityRef = { type: "USER", id: userId };
  const target: EntityRef = { type: "PAGE", id: page.id };
  // BLOCK-SEAM: a future isBlocked(userId, page) check goes here.
  if (page.profileVisibility !== ProfileVisibility.PRIVATE) {
    await grantPermission(userId, page.id, ResourceType.PAGE, PermissionRole.MEMBER);
    emitActivity("membership.joined", requester, target);
    return { status: "joined", role: PermissionRole.MEMBER };
  }
  await upsertAccessRequest(AccessRequestKind.JOIN, requester, target);
  emitActivity("membership.requested", requester, target);
  return { status: "requested" };
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

/** Pending requests targeting a page (JOIN + any page-FOLLOW), oldest first. */
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

/** Pending follow requests targeting a user, oldest first. */
export function listIncomingFollowRequests(userId: string) {
  return prisma.accessRequest.findMany({
    where: { targetUserId: userId },
    include: {
      requester: { select: requesterUserSelect },
      requesterPage: { select: requesterPageSelect },
    },
    orderBy: { createdAt: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Approve / deny — gated to the target's managers.
// ---------------------------------------------------------------------------

export type RequestActResult =
  | { ok: true; status: "approved" | "denied" }
  | { ok: false; reason: "not_found" | "forbidden" };

/**
 * Who may approve/deny a request: the targeted user themselves (their own
 * incoming follow request), or a page ADMIN. Page requests are ADMIN-only —
 * matching member management — so EDITORs can't grant or revoke membership.
 */
async function canActOnRequest(
  actorUserId: string,
  req: { targetUserId: string | null; targetPageId: string | null },
): Promise<boolean> {
  if (req.targetUserId) return req.targetUserId === actorUserId;
  if (req.targetPageId) return canManagePage(actorUserId, req.targetPageId);
  return false;
}

/** Materialize an approved request's edge inside a transaction. */
async function materialize(
  req: { kind: AccessRequestKind; requesterId: string | null; requesterPageId: string | null; targetUserId: string | null; targetPageId: string | null },
  tx: Client,
) {
  if (req.kind === AccessRequestKind.FOLLOW) {
    await tx.follow.create({
      data: {
        followerId: req.requesterId,
        followerPageId: req.requesterPageId,
        followingUserId: req.targetUserId,
        followingPageId: req.targetPageId,
      },
    });
  } else {
    // JOIN: requester is a user, target is a page.
    await grantPermission(req.requesterId!, req.targetPageId!, ResourceType.PAGE, PermissionRole.MEMBER, tx);
  }
}

/** Approve a request: materialize the edge and delete the request, atomically. */
export async function approveRequest(actorUserId: string, requestId: string): Promise<RequestActResult> {
  const req = await prisma.accessRequest.findUnique({ where: { id: requestId } });
  if (!req) return { ok: false, reason: "not_found" };
  if (!(await canActOnRequest(actorUserId, req))) return { ok: false, reason: "forbidden" };

  await prisma.$transaction(async (tx) => {
    await materialize(req, tx);
    await tx.accessRequest.delete({ where: { id: req.id } });
  });
  return { ok: true, status: "approved" };
}

/** Deny a request: delete it. Re-requesting later is allowed. */
export async function denyRequest(actorUserId: string, requestId: string): Promise<RequestActResult> {
  const req = await prisma.accessRequest.findUnique({ where: { id: requestId } });
  if (!req) return { ok: false, reason: "not_found" };
  if (!(await canActOnRequest(actorUserId, req))) return { ok: false, reason: "forbidden" };

  await prisma.accessRequest.delete({ where: { id: req.id } });
  return { ok: true, status: "denied" };
}

/**
 * When an entity flips PRIVATE → PUBLIC/UNLISTED, the reason to gate is gone:
 * materialize every pending request targeting it, then drop them. Call inside
 * the same transaction as the visibility change.
 */
export async function autoApprovePendingOnUnlock(entity: EntityRef, tx: Client = prisma): Promise<void> {
  const where = entity.type === "USER" ? { targetUserId: entity.id } : { targetPageId: entity.id };
  const pending = await tx.accessRequest.findMany({ where });
  for (const req of pending) {
    await materialize(req, tx);
  }
  if (pending.length > 0) {
    await tx.accessRequest.deleteMany({ where });
  }
}

/**
 * Out-of-scope seam (documented, not built): a PRIVATE page currently grants the
 * same access to a follow edge and a membership edge. The planned future model
 * splits these — followers see public updates, members see private content — at
 * which point FOLLOW vs JOIN approval would gate different surfaces. Not in beta.
 */
