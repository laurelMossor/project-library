/**
 * Admin member-management routes — role assignability under the membership flag.
 *
 * Uses the REAL `assignableRoles()` policy (only the flag + the DB-write boundary are
 * mocked), so these assert the actual gate: while membership is flagged off, MEMBER
 * can't be assigned on add (POST) or on role-change (PUT), and the last-admin guard
 * still fires on its own axis.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { PermissionRole } from "@prisma/client";

const flag = vi.hoisted(() => ({ on: false }));
vi.mock("@/lib/const/features", () => ({
  FEATURES: {
    get SELF_SERVICE_MEMBERSHIP() {
      return flag.on;
    },
  },
}));
// NOTE: @/lib/const/roles is intentionally NOT mocked — assignableRoles() is the real
// policy under test. Only the flag it reads and the DB writes are stubbed.

vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/permission", () => ({
  canManagePage: vi.fn(),
  grantPermission: vi.fn(),
  revokePermission: vi.fn(),
  wouldRemoveLastAdmin: vi.fn(),
  getResourcePermissions: vi.fn(),
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
import { PUT } from "@/app/api/pages/[pageId]/members/[userId]/route";
import { getSessionContext } from "@/lib/utils/server/session";
import { canManagePage, grantPermission, wouldRemoveLastAdmin } from "@/lib/utils/server/permission";

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

describe("POST /members — add with a role (flag OFF, real assignableRoles)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flag.on = false;
    vi.mocked(getSessionContext).mockResolvedValue({ userId: "admin" } as never);
    vi.mocked(canManagePage).mockResolvedValue(true); // caller is an admin
  });

  test("role=MEMBER → 400, no grant (MEMBER is not assignable while flagged off)", async () => {
    const res = await POST(addReq(PermissionRole.MEMBER), addCtx);
    expect(res.status).toBe(400);
    expect(grantPermission).not.toHaveBeenCalled();
  });

  test("role=EDITOR → 201, grant issued (EDITOR is assignable)", async () => {
    vi.mocked(grantPermission).mockResolvedValue({} as never);
    const res = await POST(addReq(PermissionRole.EDITOR), addCtx);
    expect(res.status).toBe(201);
    expect(grantPermission).toHaveBeenCalledWith("u2", "p1", expect.anything(), PermissionRole.EDITOR);
  });
});

describe("PUT /members/[userId] — change role (flag OFF, real assignableRoles)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flag.on = false;
    vi.mocked(getSessionContext).mockResolvedValue({ userId: "admin" } as never);
    vi.mocked(canManagePage).mockResolvedValue(true);
  });

  test("demote to MEMBER → 400, no write (rejected before the last-admin check)", async () => {
    const res = await PUT(putReq(PermissionRole.MEMBER), putCtx);
    expect(res.status).toBe(400);
    expect(grantPermission).not.toHaveBeenCalled();
    // The MEMBER rejection short-circuits — the last-admin guard is never even reached.
    expect(wouldRemoveLastAdmin).not.toHaveBeenCalled();
  });

  test("assignable role (EDITOR) but demoting the sole admin → 400 via the independent last-admin guard", async () => {
    vi.mocked(wouldRemoveLastAdmin).mockResolvedValue(true);
    const res = await PUT(putReq(PermissionRole.EDITOR), putCtx);
    expect(res.status).toBe(400);
    expect(wouldRemoveLastAdmin).toHaveBeenCalledWith("p1", "u2");
    expect(grantPermission).not.toHaveBeenCalled();
  });

  test("assignable role (EDITOR), not last admin → 200, write issued", async () => {
    vi.mocked(wouldRemoveLastAdmin).mockResolvedValue(false);
    vi.mocked(grantPermission).mockResolvedValue({} as never);
    const res = await PUT(putReq(PermissionRole.EDITOR), putCtx);
    expect(res.status).toBe(200);
    expect(grantPermission).toHaveBeenCalledWith("u2", "p1", expect.anything(), PermissionRole.EDITOR);
  });
});
