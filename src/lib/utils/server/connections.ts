// ⚠️ SERVER-ONLY: everything the Connections screen shows, read in one pass.
//
// The caller passes the signed-in user and the identity on screen. A user only sees their own
// connections. A page's pending invites, requests, and email addresses load only when that user
// is a page ADMIN (`canManagePage`); everyone else gets those slices empty.

import { prisma } from "./prisma";
import { ResourceType } from "@prisma/client";
import type { EntityRef } from "./activity";
import { DomainError } from "./domain-error";
import { getPageFollowers, getPageFollowing, getUserFollowers, getUserFollowing } from "./follow";
import { canManagePage, getResourcePermissions, getUserMemberships } from "./permission";
import {
  listIncomingFollowRequests,
  listMyInvites,
  listPageEmailInvites,
  listPageInvites,
  listPageRequests,
} from "./requests";
import type { ConnectionsData, RequestItem } from "@/lib/types/connections";

const EMPTY: ConnectionsData = {
  followers: [],
  following: [],
  members: [],
  emailInvites: [],
  memberOf: [],
  requests: [],
  invites: [],
  membershipPolicy: null,
};

type RequestRow = Awaited<ReturnType<typeof listPageRequests>>[number];

/** Pending requests as the screen shows them (follow and join; invites are listed elsewhere). */
function toRequestItems(rows: RequestRow[]): RequestItem[] {
  return rows.flatMap((r) =>
    r.kind === "FOLLOW" || r.kind === "JOIN"
      ? [{ id: r.id, kind: r.kind, requester: r.requester, requesterPage: r.requesterPage }]
      : [],
  );
}

/** Connections for `entity`. `actorId` is the signed-in user; admin-only slices are decided here. */
export async function getConnectionsData(actorId: string, entity: EntityRef): Promise<ConnectionsData> {
  if (entity.type === "USER") {
    if (entity.id !== actorId) {
      throw new DomainError("You can only view your own connections", "forbidden");
    }
    return getUserConnections(entity.id);
  }
  return getPageConnections(actorId, entity.id);
}

async function getUserConnections(userId: string): Promise<ConnectionsData> {
  const [followers, following, memberships, requests, invites] = await Promise.all([
    getUserFollowers(userId),
    getUserFollowing(userId),
    getUserMemberships(userId),
    listIncomingFollowRequests(userId),
    listMyInvites(userId),
  ]);
  return {
    ...EMPTY,
    followers,
    following,
    memberOf: memberships,
    requests: toRequestItems(requests),
    invites: invites.map((inv) => ({ id: inv.id, role: inv.role, note: inv.note, page: inv.requesterPage })),
  };
}

async function getPageConnections(actorId: string, pageId: string): Promise<ConnectionsData> {
  // The role check runs with the lists everyone can see. Admin-only lists wait on that result,
  // so an editor never starts those queries.
  const [followers, following, permissions, page, isAdmin] = await Promise.all([
    getPageFollowers(pageId),
    getPageFollowing(pageId),
    getResourcePermissions(pageId, ResourceType.PAGE),
    prisma.page.findUnique({ where: { id: pageId }, select: { membershipPolicy: true } }),
    canManagePage(actorId, pageId),
  ]);
  const [requests, invites, emailInvites] = isAdmin
    ? await Promise.all([listPageRequests(pageId), listPageInvites(pageId), listPageEmailInvites(pageId)])
    : [[], [], []];

  // An invite that went out by email is listed by its email row only (see listPageEmailInvites):
  // the matching profile invite is hidden, so the list never reveals which addresses have accounts.
  const sentByEmail = new Set(emailInvites.map((inv) => inv.claimedUserId).filter(Boolean));
  const pending = invites.flatMap((inv) =>
    inv.targetUser && inv.role && !sentByEmail.has(inv.targetUser.id)
      ? [{ id: inv.id, role: inv.role, pending: true, user: inv.targetUser }]
      : [],
  );

  return {
    ...EMPTY,
    followers,
    following,
    members: [...permissions.map((p) => ({ id: p.id, role: p.role, pending: false, user: p.user })), ...pending],
    // claimedUserId stays on the server.
    emailInvites: emailInvites.map((inv) => ({ id: inv.id, email: inv.email, role: inv.role })),
    requests: toRequestItems(requests),
    membershipPolicy: page?.membershipPolicy ?? null,
  };
}
