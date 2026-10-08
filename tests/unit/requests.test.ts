/**
 * Access-request choke point tests — requestOrCreateFollow / requestOrJoinPage /
 * approveRequest / denyRequest. Prisma + the notification seam are mocked.
 *
 * The load-bearing invariant: a PRIVATE target creates an AccessRequest and NO
 * grant edge (no Follow, no Permission). Approval is what materializes the edge.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { ProfileVisibility, PermissionRole, ResourceType } from "@prisma/client";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: {
    follow: { findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    user: { findUnique: vi.fn() },
    page: { findUnique: vi.fn() },
    permission: { findFirst: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), count: vi.fn(), deleteMany: vi.fn() },
    accessRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));
vi.mock("@/lib/utils/server/log", () => ({ logAction: vi.fn() }));

// ⚠️ GOTCHA — stub the session module in any unit suite that reaches the notification write path.
//
// Anything that fires a notification imports the dispatcher, and that import fans out to the auth
// stack at LOAD time (before a single test runs):
//   requests.ts / rsvp.ts / comment.ts → activity.ts → notification.ts → visibility.ts →
//   session.ts → auth.ts → next-auth
// next-auth's ESM entry doesn't resolve under Vitest, so the suite dies during import with a
// MISLEADING error that names next-auth, not your test:
//   "Cannot find module '.../node_modules/next/server' ... Did you mean 'next/server.js'?"
//
// It is NOT a real dependency of these tests — the code paths here never read the session. Stubbing
// the module short-circuits the auth import so the suite loads. If you add a new server-util suite
// that touches follows / RSVPs / comments / notifications and see that next-auth error, copy this
// line (siblings: notification-routes, notification-dispatch, membership-route, comment-routes).
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));

import {
  requestOrCreateFollow,
  requestToJoinPage,
  invitePageMember,
  approveRequest,
  denyRequest,
  autoApprovePendingOnUnlock,
  removeMember,
} from "@/lib/utils/server/requests";
import { prisma } from "@/lib/utils/server/prisma";

beforeEach(() => {
  vi.clearAllMocks();
  // Default: $transaction runs its callback with the mocked client.
  vi.mocked(prisma.$transaction).mockImplementation(async (cb) => cb(prisma));
  vi.mocked(prisma.follow.findFirst).mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// requestOrCreateFollow
// ---------------------------------------------------------------------------
describe("requestOrCreateFollow", () => {
  const requester = { type: "USER" as const, id: "u1" };

  test("PUBLIC target → instant follow, no request", async () => {
    const res = await requestOrCreateFollow(requester, { type: "USER", id: "u2", profileVisibility: ProfileVisibility.PUBLIC});
    expect(res).toEqual({ status: "followed" });
    expect(prisma.follow.create).toHaveBeenCalledTimes(1);
    expect(prisma.accessRequest.create).not.toHaveBeenCalled();
  });

  test("PUBLIC page target → instant follow", async () => {
    const res = await requestOrCreateFollow(requester, { type: "PAGE", id: "p2", profileVisibility: ProfileVisibility.PUBLIC});
    expect(res).toEqual({ status: "followed" });
    expect(prisma.follow.create).toHaveBeenCalledTimes(1);
  });

  // The load-bearing gate behind the membership feature-flag decision: with Join hidden,
  // Follow is the only path to a PRIVATE page — and it must still require approval, not
  // instant-grant access. (The private-USER case is covered below; this locks the page case.)
  test("PRIVATE page target → pending FOLLOW request, NO follow edge", async () => {
    vi.mocked(prisma.accessRequest.findFirst).mockResolvedValue(null);
    const res = await requestOrCreateFollow(requester, { type: "PAGE", id: "p2", profileVisibility: ProfileVisibility.PRIVATE});
    expect(res).toEqual({ status: "requested" });
    expect(prisma.accessRequest.create).toHaveBeenCalledTimes(1);
    expect(prisma.follow.create).not.toHaveBeenCalled();
  });

  test("PRIVATE target → pending request, NO follow edge", async () => {
    vi.mocked(prisma.accessRequest.findFirst).mockResolvedValue(null);
    const res = await requestOrCreateFollow(requester, { type: "USER", id: "u2", profileVisibility: ProfileVisibility.PRIVATE});
    expect(res).toEqual({ status: "requested" });
    expect(prisma.accessRequest.create).toHaveBeenCalledTimes(1);
    expect(prisma.follow.create).not.toHaveBeenCalled();
  });

  test("PRIVATE target, request already pending → idempotent (no second row)", async () => {
    vi.mocked(prisma.accessRequest.findFirst).mockResolvedValue({ id: "req-1" } as never);
    const res = await requestOrCreateFollow(requester, { type: "USER", id: "u2", profileVisibility: ProfileVisibility.PRIVATE});
    expect(res).toEqual({ status: "requested" });
    expect(prisma.accessRequest.create).not.toHaveBeenCalled();
  });
});

describe("requestToJoinPage", () => {
  test("REQUEST_TO_JOIN → pending JOIN, no grant", async () => {
    vi.mocked(prisma.accessRequest.findFirst).mockResolvedValue(null);
    const res = await requestToJoinPage("u1", { id: "p1", membershipPolicy: "REQUEST_TO_JOIN" });
    expect(res).toEqual({ status: "requested" });
    expect(prisma.accessRequest.create).toHaveBeenCalledTimes(1);
    expect(prisma.permission.upsert).not.toHaveBeenCalled();
  });

  test("CLOSED → unavailable, no request", async () => {
    const res = await requestToJoinPage("u1", { id: "p1", membershipPolicy: "CLOSED" });
    expect(res).toEqual({ status: "unavailable" });
    expect(prisma.accessRequest.create).not.toHaveBeenCalled();
  });

  test("INVITE_ONLY → unavailable", async () => {
    const res = await requestToJoinPage("u1", { id: "p1", membershipPolicy: "INVITE_ONLY" });
    expect(res).toEqual({ status: "unavailable" });
    expect(prisma.accessRequest.create).not.toHaveBeenCalled();
  });
});

describe("invitePageMember", () => {
  test("MEMBER on a CLOSED page → invalid_role", async () => {
    vi.mocked(prisma.page.findUnique).mockResolvedValue({ id: "p1", membershipPolicy: "CLOSED" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u2" } as never);
    const res = await invitePageMember("p1", "u2", PermissionRole.MEMBER);
    expect(res).toEqual({ ok: false, reason: "invalid_role" });
    expect(prisma.accessRequest.create).not.toHaveBeenCalled();
  });

  test("MEMBER on INVITE_ONLY → invited", async () => {
    vi.mocked(prisma.page.findUnique).mockResolvedValue({ id: "p1", membershipPolicy: "INVITE_ONLY" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u2" } as never);
    vi.mocked(prisma.permission.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.accessRequest.findFirst).mockResolvedValue(null);
    const res = await invitePageMember("p1", "u2", PermissionRole.MEMBER);
    expect(res).toEqual({ ok: true, status: "invited" });
    expect(prisma.accessRequest.create).toHaveBeenCalledTimes(1);
    expect(prisma.permission.upsert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// approveRequest / denyRequest
// ---------------------------------------------------------------------------
describe("approveRequest", () => {
  test("missing request → not_found", async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(null);
    expect(await approveRequest("actor", "req-x")).toEqual({ ok: false, reason: "not_found" });
  });

  test("actor cannot manage the target → forbidden", async () => {
    // Target is a page; canManagePage checks ADMIN → none.
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      id: "req-1", kind: "JOIN", requesterId: "u1", requesterPageId: null,
      targetUserId: null, targetPageId: "p1",
    } as never);
    vi.mocked(prisma.permission.findFirst).mockResolvedValue(null);
    expect(await approveRequest("intruder", "req-1")).toEqual({ ok: false, reason: "forbidden" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("page requests are gated ADMIN-only (EDITOR excluded)", async () => {
    // A blanket findFirst mock can't tell ADMIN from EDITOR, so assert the gate
    // queries with role: { in: [ADMIN] } — proving EDITORs can't approve.
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      id: "req-3", kind: "JOIN", requesterId: "u1", requesterPageId: null,
      targetUserId: null, targetPageId: "p1",
    } as never);
    vi.mocked(prisma.permission.findFirst).mockResolvedValue({ role: PermissionRole.ADMIN } as never);
    await approveRequest("admin", "req-3");
    expect(prisma.permission.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: "admin",
        resourceId: "p1",
        resourceType: ResourceType.PAGE,
        role: { in: [PermissionRole.ADMIN] },
      }),
    });
  });

  test("FOLLOW to a user, approved by that user → materializes Follow + deletes request", async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      id: "req-1", kind: "FOLLOW", requesterId: "u1", requesterPageId: null,
      targetUserId: "owner", targetPageId: null,
    } as never);
    const res = await approveRequest("owner", "req-1"); // user-target: actor === targetUserId
    expect(res).toEqual({ ok: true, status: "approved" });
    expect(prisma.follow.create).toHaveBeenCalledTimes(1);
    expect(prisma.accessRequest.delete).toHaveBeenCalledWith({ where: { id: "req-1" } });
  });

  test("JOIN approved by an admin → MEMBER + follow, request deleted", async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      id: "req-2", kind: "JOIN", role: null, requesterId: "u1", requesterPageId: null,
      targetUserId: null, targetPageId: "p1",
    } as never);
    vi.mocked(prisma.permission.findFirst).mockResolvedValue({ role: PermissionRole.ADMIN } as never);
    const res = await approveRequest("admin", "req-2");
    expect(res).toEqual({ ok: true, status: "approved" });
    expect(prisma.permission.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.follow.create).toHaveBeenCalledTimes(1);
    expect(prisma.accessRequest.delete).toHaveBeenCalledWith({ where: { id: "req-2" } });
  });

  test("INVITE accepted by the invitee → permission + follow, leftover JOIN dropped", async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      id: "req-i", kind: "INVITE", role: PermissionRole.EDITOR,
      requesterId: null, requesterPageId: "p1", targetUserId: "u2", targetPageId: null,
    } as never);
    vi.mocked(prisma.page.findUnique).mockResolvedValue({ membershipPolicy: "INVITE_ONLY" } as never);
    const res = await approveRequest("u2", "req-i");
    expect(res).toEqual({ ok: true, status: "approved" });
    expect(prisma.permission.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.follow.create).toHaveBeenCalledTimes(1);
    expect(prisma.accessRequest.deleteMany).toHaveBeenCalledWith({
      where: { kind: "JOIN", requesterId: "u2", targetPageId: "p1" },
    });
  });

  test("JOIN approve leaves an existing higher role in place", async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      id: "req-2", kind: "JOIN", role: null, requesterId: "u1", requesterPageId: null,
      targetUserId: null, targetPageId: "p1",
    } as never);
    vi.mocked(prisma.permission.findFirst).mockResolvedValue({ role: PermissionRole.ADMIN } as never);
    vi.mocked(prisma.permission.findUnique).mockResolvedValue({ role: PermissionRole.EDITOR } as never);
    const res = await approveRequest("admin", "req-2");
    expect(res).toEqual({ ok: true, status: "approved" });
    expect(prisma.permission.upsert).not.toHaveBeenCalled();
    expect(prisma.follow.create).not.toHaveBeenCalled();
    expect(prisma.accessRequest.delete).toHaveBeenCalledWith({ where: { id: "req-2" } });
  });

  test("INVITE accept after the page is CLOSED → unavailable, nothing granted", async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      id: "req-i", kind: "INVITE", role: PermissionRole.MEMBER,
      requesterId: null, requesterPageId: "p1", targetUserId: "u2", targetPageId: null,
    } as never);
    vi.mocked(prisma.page.findUnique).mockResolvedValue({ membershipPolicy: "CLOSED" } as never);
    const res = await approveRequest("u2", "req-i");
    expect(res).toEqual({ ok: false, reason: "unavailable" });
    expect(prisma.permission.upsert).not.toHaveBeenCalled();
    expect(prisma.accessRequest.delete).toHaveBeenCalledWith({ where: { id: "req-i" } });
  });

  test("an admin can cancel an invite but cannot accept it", async () => {
    const invite = {
      id: "req-i", kind: "INVITE", role: PermissionRole.MEMBER,
      requesterId: null, requesterPageId: "p1", targetUserId: "u2", targetPageId: null,
    };
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(invite as never);
    vi.mocked(prisma.permission.findFirst).mockResolvedValue({ role: PermissionRole.ADMIN } as never);
    expect(await approveRequest("admin", "req-i")).toEqual({ ok: false, reason: "forbidden" });
    expect(await denyRequest("admin", "req-i")).toEqual({ ok: true, status: "denied" });
  });
});

describe("autoApprovePendingOnUnlock", () => {
  test("only looks at FOLLOW requests", async () => {
    vi.mocked(prisma.accessRequest.findMany).mockResolvedValue([]);
    await autoApprovePendingOnUnlock({ type: "PAGE", id: "p1" });
    expect(prisma.accessRequest.findMany).toHaveBeenCalledWith({
      where: { targetPageId: "p1", kind: "FOLLOW" },
    });
  });
});

describe("removeMember", () => {
  test("revokes the role and deletes the follow in one transaction", async () => {
    await removeMember("u2", "p1");
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.permission.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u2", resourceId: "p1", resourceType: ResourceType.PAGE },
    });
    expect(prisma.follow.deleteMany).toHaveBeenCalledWith({
      where: { followerId: "u2", followingPageId: "p1" },
    });
  });
});

describe("denyRequest", () => {
  test("deletes the request (re-request allowed later)", async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      id: "req-1", kind: "FOLLOW", requesterId: "u1", requesterPageId: null,
      targetUserId: "owner", targetPageId: null,
    } as never);
    const res = await denyRequest("owner", "req-1");
    expect(res).toEqual({ ok: true, status: "denied" });
    expect(prisma.accessRequest.delete).toHaveBeenCalledWith({ where: { id: "req-1" } });
    expect(prisma.follow.create).not.toHaveBeenCalled();
  });

  test("non-manager → forbidden, nothing deleted", async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      id: "req-1", kind: "FOLLOW", requesterId: "u1", requesterPageId: null,
      targetUserId: "owner", targetPageId: null,
    } as never);
    expect(await denyRequest("intruder", "req-1")).toEqual({ ok: false, reason: "forbidden" });
    expect(prisma.accessRequest.delete).not.toHaveBeenCalled();
  });
});
