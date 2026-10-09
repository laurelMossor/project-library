// ⚠️ SERVER-ONLY: everything the Connections screen shows, read in one pass.
//
// The screen is always the viewer's own acting identity (themselves, or a page they act as),
// so nothing here re-gates visibility: the caller passes the identity it already resolved and
// whether that identity is a page ADMIN. ADMIN-only slices (pending invites, requests) are
// returned empty for everyone else.

import { prisma } from "./prisma";
import { ResourceType } from "@prisma/client";
import type { EntityRef } from "./activity";
import { getPageFollowers, getPageFollowing, getUserFollowers, getUserFollowing } from "./follow";
import { getResourcePermissions, getUserMemberships } from "./permission";
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

/** `isAdmin`: the identity is a page the viewer manages (ADMIN). Ignored for a user. */
export async function getConnectionsData(entity: EntityRef, isAdmin: boolean): Promise<ConnectionsData> {
  return entity.type === "USER" ? getUserConnections(entity.id) : getPageConnections(entity.id, isAdmin);
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

async function getPageConnections(pageId: string, isAdmin: boolean): Promise<ConnectionsData> {
  const [followers, following, permissions, page, requests, invites, emailInvites] = await Promise.all([
    getPageFollowers(pageId),
    getPageFollowing(pageId),
    getResourcePermissions(pageId, ResourceType.PAGE),
    prisma.page.findUnique({ where: { id: pageId }, select: { membershipPolicy: true } }),
    isAdmin ? listPageRequests(pageId) : [],
    isAdmin ? listPageInvites(pageId) : [],
    isAdmin ? listPageEmailInvites(pageId) : [],
  ]);

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
