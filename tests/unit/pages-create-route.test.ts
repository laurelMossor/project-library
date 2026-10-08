/**
 * POST /api/pages accepts an optional cuid-shaped id so the create form can
 * preview the avatar the page will keep. A bad id is 400. A taken id is 400
 * asking the caller to try again, distinct from a taken handle.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { createCuid } from "@/lib/utils/cuid";

vi.mock("@/lib/utils/server/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/page", () => ({ createPage: vi.fn() }));
vi.mock("@/lib/utils/server/handle", () => ({
  generateUniqueHandle: vi.fn(),
  isHandleTaken: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/utils/server/log", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/utils/server/image-attachment", () => ({
  AvatarNotAllowed: class AvatarNotAllowed extends Error {},
}));

import { POST } from "@/app/api/pages/route";
import { getSessionContext } from "@/lib/utils/server/session";
import { createPage } from "@/lib/utils/server/page";

function post(body: unknown) {
  return POST(new Request("http://localhost/api/pages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionContext).mockResolvedValue({ userId: "u1", activePageId: null } as never);
  vi.mocked(createPage).mockResolvedValue({ id: "page-1", handle: "makers" } as never);
});

describe("POST /api/pages id", () => {
  test("a valid new id is accepted and passed through", async () => {
    const id = createCuid();
    const res = await post({ id, name: "Makers", handle: "makers" });
    expect(res.status).toBe(201);
    expect(createPage).toHaveBeenCalledWith("u1", expect.objectContaining({ id, name: "Makers", handle: "makers" }));
  });

  test("a malformed id → 400", async () => {
    const res = await post({ id: "not-a-cuid", name: "Makers", handle: "makers" });
    expect(res.status).toBe(400);
    expect(createPage).not.toHaveBeenCalled();
  });

  test("a taken id → 400 try again", async () => {
    vi.mocked(createPage).mockRejectedValue({ code: "P2002", meta: { target: ["id"] } });
    const res = await post({ id: createCuid(), name: "Makers", handle: "makers" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/try again/i);
  });
});
