/**
 * Tests for DELETE /api/pages/[pageId]/membership (self-service leave).
 *
 * Locks the seam the unit tests for `wouldRemoveLastAdmin` don't cover: that the
 * route actually consults the guard and refuses to let the sole admin leave
 * (which would orphan the page), and that an ordinary member can leave.
 * Permission + requests helpers are mocked — no DB needed.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { PermissionRole } from "@prisma/client";

// Membership flag: a getter over a hoisted holder so a test can flip it and the route
// re-reads the current value at call time.
const flag = vi.hoisted(() => ({ on: false }));
vi.mock("@/lib/const/features", () => ({
  FEATURES: {
    get SELF_SERVICE_MEMBERSHIP() {
      return flag.on;
    },
  },
}));

vi.mock("@/lib/utils/server/prisma", () => ({ prisma: { page: { findUnique: vi.fn() } } }));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/permission", () => ({
  getUserPermission: vi.fn(),
  revokePermission: vi.fn(),
  isSelfServiceRole: vi.fn(),
  wouldRemoveLastAdmin: vi.fn(),
}));
vi.mock("@/lib/utils/server/requests", () => ({
  requestOrJoinPage: vi.fn(),
  hasPendingJoinRequest: vi.fn(),
  cancelJoinRequest: vi.fn(),
}));
vi.mock("@/lib/utils/errors", () => ({
  unauthorized: (msg?: string) => new Response(JSON.stringify({ error: msg ?? "Unauthorized" }), { status: 401 }),
  badRequest: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400 }),
  notFound: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 404 }),
  serverError: (msg?: string) => new Response(JSON.stringify({ error: msg ?? "Internal server error" }), { status: 500 }),
}));

import { DELETE, POST } from "@/app/api/pages/[pageId]/membership/route";
import { getSessionContext } from "@/lib/utils/server/session";
import { prisma } from "@/lib/utils/server/prisma";
import { getUserPermission, revokePermission, wouldRemoveLastAdmin, isSelfServiceRole } from "@/lib/utils/server/permission";
import { cancelJoinRequest, requestOrJoinPage } from "@/lib/utils/server/requests";

const ctx = { params: Promise.resolve({ pageId: "p1" }) };
const req = new Request("http://localhost/api/pages/p1/membership", { method: "DELETE" });
const postReq = new Request("http://localhost/api/pages/p1/membership", { method: "POST" });

// POST is the self-service join / request-to-JOIN entry point — the surface the
// membership flag hides. These lock the real flag branch: OFF blocks before any
// join work; ON lets the request through to requestOrJoinPage.
describe("POST /api/pages/[pageId]/membership (flag gate)", () => {
  beforeEach(() => vi.clearAllMocks());

  test("flag OFF → 404, and no join/request work is attempted", async () => {
    flag.on = false;
    vi.mocked(getSessionContext).mockResolvedValue({ userId: "u1" } as never);
    const res = await POST(postReq, ctx);
    expect(res.status).toBe(404);
    expect(requestOrJoinPage).not.toHaveBeenCalled();
    expect(prisma.page.findUnique).not.toHaveBeenCalled();
  });

  test("flag ON, no existing role → passes the gate and opens a join/request", async () => {
    flag.on = true;
    vi.mocked(getSessionContext).mockResolvedValue({ userId: "u1" } as never);
    vi.mocked(prisma.page.findUnique).mockResolvedValue({ id: "p1", profileVisibility: "PUBLIC" } as never);
    vi.mocked(getUserPermission).mockResolvedValue(null);
    vi.mocked(isSelfServiceRole).mockReturnValue(true);
    vi.mocked(requestOrJoinPage).mockResolvedValue({ status: "joined", role: PermissionRole.MEMBER } as never);
    const res = await POST(postReq, ctx);
    expect(res.status).toBe(201);
    expect(requestOrJoinPage).toHaveBeenCalledWith("u1", { id: "p1", profileVisibility: "PUBLIC" });
  });
});

describe("DELETE /api/pages/[pageId]/membership", () => {
  beforeEach(() => vi.clearAllMocks());

  test("unauthenticated → 401", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(null as never);
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(401);
  });

  test("sole admin cannot leave → 400, permission NOT revoked (last-admin guard)", async () => {
    vi.mocked(getSessionContext).mockResolvedValue({ userId: "admin" } as never);
    vi.mocked(getUserPermission).mockResolvedValue(PermissionRole.ADMIN);
    vi.mocked(wouldRemoveLastAdmin).mockResolvedValue(true);
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(400);
    expect(wouldRemoveLastAdmin).toHaveBeenCalledWith("p1", "admin");
    expect(revokePermission).not.toHaveBeenCalled();
  });

  test("ordinary member can leave → 200, permission revoked", async () => {
    vi.mocked(getSessionContext).mockResolvedValue({ userId: "u1" } as never);
    vi.mocked(getUserPermission).mockResolvedValue(PermissionRole.MEMBER);
    vi.mocked(wouldRemoveLastAdmin).mockResolvedValue(false);
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(200);
    expect(revokePermission).toHaveBeenCalledWith("u1", "p1", expect.anything());
  });

  test("no role → cancels any pending join request, 200", async () => {
    vi.mocked(getSessionContext).mockResolvedValue({ userId: "u1" } as never);
    vi.mocked(getUserPermission).mockResolvedValue(null);
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(200);
    expect(cancelJoinRequest).toHaveBeenCalledWith("u1", "p1");
    expect(revokePermission).not.toHaveBeenCalled();
  });
});
