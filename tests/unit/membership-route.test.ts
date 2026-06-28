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

vi.mock("@/lib/utils/server/prisma", () => ({ prisma: {} }));
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

import { DELETE } from "@/app/api/pages/[pageId]/membership/route";
import { getSessionContext } from "@/lib/utils/server/session";
import { getUserPermission, revokePermission, wouldRemoveLastAdmin } from "@/lib/utils/server/permission";
import { cancelJoinRequest } from "@/lib/utils/server/requests";

const ctx = { params: Promise.resolve({ pageId: "p1" }) };
const req = new Request("http://localhost/api/pages/p1/membership", { method: "DELETE" });

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
