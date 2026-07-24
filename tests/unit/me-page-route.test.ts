/**
 * PUT /api/me/page — the ADMIN-only page-visibility gate, at the route layer.
 *
 * The netwerk-8 fix made changing a page's privacy ADMIN-only while an EDITOR may still
 * edit the rest of the profile. `profile-update.test.ts` covers the util given an explicit
 * `allowVisibilityChange`; THIS test locks the route WIRING — that the route feeds
 * `canManagePage` (not `canPostAsPage`) into that flag, and maps the util's `forbidden`
 * result to 403 vs. 400 for validation errors.
 *
 * Design (house style): mock ONLY the real seams — `prisma`, `getSessionContext`, and the
 * error helpers — and let the genuine gate run: canPostAsPage / canManagePage → saveMyProfile
 * → pickProfileFields → the visibility gate → validateProfileFields → assertProfileContentPairing.
 * A user's stored role is modeled through `prisma.permission.findFirst` (both gates query it
 * with a `role: { in: [...] }` set), so nothing about the permission decision is faked. The
 * assertions are behavioral outcomes (status + whether a write ran), not mock-call inspection —
 * a regression to `canPostAsPage` would let an EDITOR through and flip 403→200, failing the test.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: {
    permission: { findFirst: vi.fn() },
    page: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/errors", () => ({
  unauthorized: (msg?: string) => new Response(JSON.stringify({ error: msg ?? "Unauthorized" }), { status: 401 }),
  badRequest: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400 }),
  notFound: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 404 }),
  serverError: (msg?: string) => new Response(JSON.stringify({ error: msg ?? "Internal server error" }), { status: 500 }),
}));

import { PUT } from "@/app/api/me/page/route";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";

// Model the caller's actual stored role on page "p1". Both gates call
// permission.findFirst with a `role: { in: roles }` set; return a row only when the
// queried set includes the stored role. `canPostAsPage` asks [ADMIN, EDITOR];
// `canManagePage` asks [ADMIN] — so EDITOR passes the first and fails the second.
function setStoredRole(role: "ADMIN" | "EDITOR" | "MEMBER" | null) {
  vi.mocked(prisma.permission.findFirst).mockImplementation(((args: { where: { role: { in: string[] } } }) => {
    const wanted = args.where.role.in;
    return Promise.resolve(role && wanted.includes(role) ? { role } : null);
  }) as never);
}

const putReq = (fields: Record<string, unknown>) =>
  new Request("http://localhost/api/me/page", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionContext).mockResolvedValue({ userId: "u1", activePageId: "p1" } as never);
  // Current page state for the PRIVATE+LISTED pairing guard's merge read.
  vi.mocked(prisma.page.findUnique).mockResolvedValue({ profileVisibility: "PUBLIC", contentVisibility: "LISTED" } as never);
  // The write seam — resolves the refetched profile so a passing save returns 200.
  vi.mocked(prisma.$transaction).mockResolvedValue({ id: "p1", name: "Page" } as never);
});

describe("PUT /api/me/page — auth & active-page guards", () => {
  test("unauthenticated → 401", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(null as never);
    expect((await PUT(putReq({ bio: "x" }))).status).toBe(401);
  });

  test("no active page → 400", async () => {
    vi.mocked(getSessionContext).mockResolvedValue({ userId: "u1", activePageId: null } as never);
    expect((await PUT(putReq({ bio: "x" }))).status).toBe(400);
  });

  test("caller has no role on the page (canPostAsPage false) → 403, no write", async () => {
    setStoredRole(null);
    const res = await PUT(putReq({ bio: "x" }));
    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("PUT /api/me/page — EDITOR (act-as-page, not admin)", () => {
  beforeEach(() => setStoredRole("EDITOR"));

  test("visibility change → 403 and NO write (the regression lock)", async () => {
    // If the route regressed to feeding canPostAsPage into allowVisibilityChange, the
    // EDITOR would pass and a write would run → 200. The 403 + no-write proves it uses
    // canManagePage (ADMIN-only) for the visibility field.
    const res = await PUT(putReq({ profileVisibility: "PRIVATE" }));
    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("non-visibility field (bio) → 200 and a write (gate is visibility-specific)", async () => {
    const res = await PUT(putReq({ bio: "An edited bio" }));
    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("PUT /api/me/page — ADMIN", () => {
  beforeEach(() => setStoredRole("ADMIN"));

  test("visibility change → 200 and a write (admin may change privacy)", async () => {
    const res = await PUT(putReq({ profileVisibility: "PRIVATE", contentVisibility: "PRIVATE" }));
    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  test("invalid combo (PRIVATE profile + LISTED content) → 400, not 403, no write", async () => {
    // A real validation/pairing failure carries no `forbidden` flag, so it must map to 400 —
    // distinct from the EDITOR permission 403, and reached without any error-string matching.
    const res = await PUT(putReq({ profileVisibility: "PRIVATE", contentVisibility: "LISTED" }));
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
