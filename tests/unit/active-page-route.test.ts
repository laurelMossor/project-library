/**
 * Tests for PUT/DELETE /api/session/active-page
 *
 * This is the server-side auth gate for profile switching.
 * auth() and canSetActivePage() are mocked — no DB or NextAuth needed.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/utils/server/session", () => ({ canSetActivePage: vi.fn() }));
// Error helpers likely use NextResponse which may not be available in jsdom; mock to plain Responses
vi.mock("@/lib/utils/errors", () => ({
  unauthorized: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
  badRequest: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400 }),
  serverError: () => new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 }),
}));

import { PUT, DELETE } from "@/app/api/session/active-page/route";
import { auth } from "@/lib/auth";
import { canSetActivePage } from "@/lib/utils/server/session";

const putRequest = (body: unknown) =>
  new Request("http://localhost/api/session/active-page", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const authedSession = { user: { id: "user-1" } };

// ---------------------------------------------------------------------------
// PUT — switch to a page identity
// ---------------------------------------------------------------------------
describe("PUT /api/session/active-page", () => {
  beforeEach(() => vi.clearAllMocks());

  test("unauthenticated → 401", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);
    const res = await PUT(putRequest({ activePageId: "page-1" }));
    expect(res.status).toBe(401);
  });

  test("missing activePageId → 400", async () => {
    vi.mocked(auth).mockResolvedValue(authedSession as any);
    const res = await PUT(putRequest({}));
    expect(res.status).toBe(400);
  });

  test("non-string activePageId → 400", async () => {
    vi.mocked(auth).mockResolvedValue(authedSession as any);
    const res = await PUT(putRequest({ activePageId: 42 }));
    expect(res.status).toBe(400);
  });

  test("user lacks permission → 403 with error message", async () => {
    vi.mocked(auth).mockResolvedValue(authedSession as any);
    vi.mocked(canSetActivePage).mockResolvedValue(false);
    const res = await PUT(putRequest({ activePageId: "page-1" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("You cannot act as this page");
  });

  test("user has permission → 200 with activePageId echoed back", async () => {
    vi.mocked(auth).mockResolvedValue(authedSession as any);
    vi.mocked(canSetActivePage).mockResolvedValue(true);
    const res = await PUT(putRequest({ activePageId: "page-1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activePageId).toBe("page-1");
  });

  test("validates permission against the correct userId and pageId", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-abc" } } as any);
    vi.mocked(canSetActivePage).mockResolvedValue(true);
    await PUT(putRequest({ activePageId: "page-xyz" }));
    expect(vi.mocked(canSetActivePage)).toHaveBeenCalledWith("user-abc", "page-xyz");
  });
});

// ---------------------------------------------------------------------------
// DELETE — return to personal identity
// ---------------------------------------------------------------------------
describe("DELETE /api/session/active-page", () => {
  beforeEach(() => vi.clearAllMocks());

  test("unauthenticated → 401", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  test("authenticated → 200 with null activePageId", async () => {
    vi.mocked(auth).mockResolvedValue(authedSession as any);
    const res = await DELETE();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activePageId).toBeNull();
  });
});
