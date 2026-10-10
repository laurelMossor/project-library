/**
 * GET /api/me/page — the acting role rides on the body, and only an acting role (ADMIN/EDITOR)
 * gets the page back. The page save that used to live on this route is a Server Action now;
 * its ADMIN-only visibility gate is covered in `profile-actions.test.ts`.
 *
 * Design (house style): mock only the real seams — `prisma`, `getSessionContext`, and the
 * error helpers — and let the genuine gate run (getActingRole).
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: {
    permission: { findFirst: vi.fn(), findUnique: vi.fn() },
    page: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/errors", () => ({
  unauthorized: (msg?: string) => new Response(JSON.stringify({ error: msg ?? "Unauthorized" }), { status: 401 }),
  notFound: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 404 }),
  serverError: (msg?: string) => new Response(JSON.stringify({ error: msg ?? "Internal server error" }), { status: 500 }),
}));

import { GET } from "@/app/api/me/page/route";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionContext).mockResolvedValue({ userId: "u1", activePageId: "p1" } as never);
  vi.mocked(prisma.page.findUnique).mockResolvedValue({ id: "p1", name: "Page" } as never);
});

describe("GET /api/me/page — acting role on the body", () => {
  test("ADMIN → 200 and the caller's role, from findUnique only", async () => {
    vi.mocked(prisma.permission.findUnique).mockResolvedValue({ role: "ADMIN" } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({ role: "ADMIN" }));
    expect(prisma.permission.findFirst).not.toHaveBeenCalled();
  });

  test("MEMBER → 404, page is not returned", async () => {
    vi.mocked(prisma.permission.findUnique).mockResolvedValue({ role: "MEMBER" } as never);
    const res = await GET();
    expect(res.status).toBe(404);
    expect(prisma.page.findUnique).not.toHaveBeenCalled();
  });

  test("no permission row → 404", async () => {
    vi.mocked(prisma.permission.findUnique).mockResolvedValue(null);
    expect((await GET()).status).toBe(404);
  });

  test("no active page → 404", async () => {
    vi.mocked(getSessionContext).mockResolvedValue({ userId: "u1", activePageId: null } as never);
    expect((await GET()).status).toBe(404);
  });

  test("unauthenticated → 401", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(null as never);
    expect((await GET()).status).toBe(401);
  });
});
