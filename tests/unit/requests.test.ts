/**
 * Access-request choke point tests — requestOrCreateFollow / requestOrJoinPage /
 * approveRequest / denyRequest. Prisma + the notification seam are mocked.
 *
 * The load-bearing invariant: a PRIVATE target creates an AccessRequest and NO
 * grant edge (no Follow, no Permission). Approval is what materializes the edge.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { Visibility, PermissionRole } from "@prisma/client";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: {
    follow: { create: vi.fn() },
    permission: { findFirst: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), count: vi.fn() },
    accessRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/utils/server/log", () => ({ logAction: vi.fn() }));

import {
  requestOrCreateFollow,
  requestOrJoinPage,
  approveRequest,
  denyRequest,
} from "@/lib/utils/server/requests";
import { prisma } from "@/lib/utils/server/prisma";

beforeEach(() => {
  vi.clearAllMocks();
  // Default: $transaction runs its callback with the mocked client.
  vi.mocked(prisma.$transaction).mockImplementation(async (cb) => cb(prisma));
});

// ---------------------------------------------------------------------------
// requestOrCreateFollow
// ---------------------------------------------------------------------------
describe("requestOrCreateFollow", () => {
  const requester = { type: "USER" as const, id: "u1" };

  test("PUBLIC target → instant follow, no request", async () => {
    const res = await requestOrCreateFollow(requester, { type: "USER", id: "u2", visibility: Visibility.PUBLIC });
    expect(res).toEqual({ status: "followed" });
    expect(prisma.follow.create).toHaveBeenCalledTimes(1);
    expect(prisma.accessRequest.create).not.toHaveBeenCalled();
  });

  test("UNLISTED target → instant follow", async () => {
    const res = await requestOrCreateFollow(requester, { type: "PAGE", id: "p2", visibility: Visibility.UNLISTED });
    expect(res).toEqual({ status: "followed" });
    expect(prisma.follow.create).toHaveBeenCalledTimes(1);
  });

  test("PRIVATE target → pending request, NO follow edge", async () => {
    vi.mocked(prisma.accessRequest.findFirst).mockResolvedValue(null);
    const res = await requestOrCreateFollow(requester, { type: "USER", id: "u2", visibility: Visibility.PRIVATE });
    expect(res).toEqual({ status: "requested" });
    expect(prisma.accessRequest.create).toHaveBeenCalledTimes(1);
    expect(prisma.follow.create).not.toHaveBeenCalled();
  });

  test("PRIVATE target, request already pending → idempotent (no second row)", async () => {
    vi.mocked(prisma.accessRequest.findFirst).mockResolvedValue({ id: "req-1" } as never);
    const res = await requestOrCreateFollow(requester, { type: "USER", id: "u2", visibility: Visibility.PRIVATE });
    expect(res).toEqual({ status: "requested" });
    expect(prisma.accessRequest.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// requestOrJoinPage
// ---------------------------------------------------------------------------
describe("requestOrJoinPage", () => {
  test("PUBLIC page → instant MEMBER grant", async () => {
    const res = await requestOrJoinPage("u1", { id: "p1", visibility: Visibility.PUBLIC });
    expect(res).toEqual({ status: "joined", role: PermissionRole.MEMBER });
    expect(prisma.permission.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.accessRequest.create).not.toHaveBeenCalled();
  });

  test("PRIVATE page → pending request, NO permission grant", async () => {
    vi.mocked(prisma.accessRequest.findFirst).mockResolvedValue(null);
    const res = await requestOrJoinPage("u1", { id: "p1", visibility: Visibility.PRIVATE });
    expect(res).toEqual({ status: "requested" });
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
    // Target is a page; canManageEntity checks ADMIN/EDITOR → none.
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      id: "req-1", kind: "JOIN", requesterId: "u1", requesterPageId: null,
      targetUserId: null, targetPageId: "p1",
    } as never);
    vi.mocked(prisma.permission.findFirst).mockResolvedValue(null);
    expect(await approveRequest("intruder", "req-1")).toEqual({ ok: false, reason: "forbidden" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
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

  test("JOIN to a page, approved by an admin → grants MEMBER + deletes request", async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      id: "req-2", kind: "JOIN", requesterId: "u1", requesterPageId: null,
      targetUserId: null, targetPageId: "p1",
    } as never);
    vi.mocked(prisma.permission.findFirst).mockResolvedValue({ role: PermissionRole.ADMIN } as never);
    const res = await approveRequest("admin", "req-2");
    expect(res).toEqual({ ok: true, status: "approved" });
    expect(prisma.permission.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.accessRequest.delete).toHaveBeenCalledWith({ where: { id: "req-2" } });
    expect(prisma.follow.create).not.toHaveBeenCalled();
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
