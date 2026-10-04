/**
 * Member routes. POST invites (the invitee accepts later). PUT changes an
 * existing member's role, gated by the page's membership policy.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { PermissionRole } from "@prisma/client";

vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/activity", () => ({ emitActivity: vi.fn() }));
vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: { page: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/utils/server/permission", () => ({
  canManagePage: vi.fn(),
  getUserPermission: vi.fn(),
  grantPermission: vi.fn(),
  revokePermission: vi.fn(),
  wouldRemoveLastAdmin: vi.fn(),
  getResourcePermissions: vi.fn(),
}));
vi.mock("@/lib/utils/server/requests", () => ({
  invitePageMember: vi.fn(),
  listPageInvites: vi.fn(),
  removeMember: vi.fn(),
}));
vi.mock("@/lib/utils/server/visibility", () => ({
  getViewerContext: vi.fn(),
  requireViewableProfile: vi.fn(),
}));
vi.mock("@/lib/utils/errors", () => ({
  unauthorized: (msg?: string) => new Response(JSON.stringify({ error: msg ?? "Unauthorized" }), { status: 401 }),
  badRequest: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400 }),
  notFound: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 404 }),
  serverError: (msg?: string) => new Response(JSON.stringify({ error: msg ?? "Internal server error" }), { status: 500 }),
}));

import { POST } from "@/app/api/pages/[pageId]/members/route";
import { PUT, DELETE } from "@/app/api/pages/[pageId]/members/[userId]/route";
import { getSessionContext } from "@/lib/utils/server/session";
import { prisma } from "@/lib/utils/server/prisma";
import { canManagePage, getUserPermission, grantPermission, wouldRemoveLastAdmin } from "@/lib/utils/server/permission";
import { invitePageMember, removeMember } from "@/lib/utils/server/requests";

const addReq = (role: string) =>
  new Request("http://localhost/api/pages/p1/members", {
    method: "POST",
    body: JSON.stringify({ userId: "u2", role }),
  });
const addCtx = { params: Promise.resolve({ pageId: "p1" }) };

const putReq = (role: string) =>
  new Request("http://localhost/api/pages/p1/members/u2", {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
const putCtx = { params: Promise.resolve({ pageId: "p1", userId: "u2" }) };

describe("POST /members — invite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionContext).mockResolvedValue({ userId: "admin" } as never);
    vi.mocked(canManagePage).mockResolvedValue(true);
  });

  test("a role the page won't offer → 400, nothing granted", async () => {
    vi.mocked(invitePageMember).mockResolvedValue({ ok: false, reason: "invalid_role" });
    const res = await POST(addReq(PermissionRole.MEMBER), addCtx);
    expect(res.status).toBe(400);
    expect(grantPermission).not.toHaveBeenCalled();
  });

  test("an offered role → 201 invited, no grant", async () => {
    vi.mocked(invitePageMember).mockResolvedValue({ ok: true, status: "invited" });
    const res = await POST(addReq(PermissionRole.EDITOR), addCtx);
    expect(res.status).toBe(201);
    expect(invitePageMember).toHaveBeenCalledWith("p1", "u2", PermissionRole.EDITOR);
    expect(grantPermission).not.toHaveBeenCalled();
  });
});

describe("PUT /members/[userId] — change role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionContext).mockResolvedValue({ userId: "admin" } as never);
    vi.mocked(canManagePage).mockResolvedValue(true);
    vi.mocked(prisma.page.findUnique).mockResolvedValue({ membershipPolicy: "CLOSED" } as never);
    vi.mocked(getUserPermission).mockResolvedValue(PermissionRole.ADMIN);
  });

  test("demote to MEMBER on a CLOSED page → 400, no write", async () => {
    const res = await PUT(putReq(PermissionRole.MEMBER), putCtx);
    expect(res.status).toBe(400);
    expect(grantPermission).not.toHaveBeenCalled();
    expect(wouldRemoveLastAdmin).not.toHaveBeenCalled();
  });

  test("MEMBER is allowed once the page invites members", async () => {
    vi.mocked(prisma.page.findUnique).mockResolvedValue({ membershipPolicy: "INVITE_ONLY" } as never);
    vi.mocked(wouldRemoveLastAdmin).mockResolvedValue(false);
    vi.mocked(grantPermission).mockResolvedValue({} as never);
    const res = await PUT(putReq(PermissionRole.MEMBER), putCtx);
    expect(res.status).toBe(200);
    expect(grantPermission).toHaveBeenCalled();
  });

  test("demoting the sole admin → 400", async () => {
    vi.mocked(wouldRemoveLastAdmin).mockResolvedValue(true);
    const res = await PUT(putReq(PermissionRole.EDITOR), putCtx);
    expect(res.status).toBe(400);
    expect(grantPermission).not.toHaveBeenCalled();
  });

  test("someone with no role → 400 (they need an invite)", async () => {
    vi.mocked(getUserPermission).mockResolvedValue(null);
    const res = await PUT(putReq(PermissionRole.EDITOR), putCtx);
    expect(res.status).toBe(400);
    expect(grantPermission).not.toHaveBeenCalled();
  });
});

describe("DELETE /members/[userId] — admin remove", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionContext).mockResolvedValue({ userId: "admin" } as never);
    vi.mocked(canManagePage).mockResolvedValue(true);
    vi.mocked(wouldRemoveLastAdmin).mockResolvedValue(false);
  });

  test("drops the role and the follow together", async () => {
    const res = await DELETE(new Request("http://localhost/api/pages/p1/members/u2"), putCtx);
    expect(res.status).toBe(200);
    expect(removeMember).toHaveBeenCalledWith("u2", "p1");
  });
});
