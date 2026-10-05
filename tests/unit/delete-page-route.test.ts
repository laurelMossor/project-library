import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: { $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})) },
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/permission", () => ({ canManagePage: vi.fn() }));
vi.mock("@/lib/utils/server/page", () => ({ deletePage: vi.fn(), getPageById: vi.fn() }));
vi.mock("@/lib/utils/server/storage", () => ({ removeStoragePaths: vi.fn() }));
vi.mock("@/lib/utils/server/visibility", () => ({ getViewerContext: vi.fn(), canViewProfile: vi.fn() }));
vi.mock("@/lib/utils/server/profile-update", () => ({ saveMyProfile: vi.fn() }));

import { DELETE } from "@/app/api/pages/[pageId]/route";
import { getSessionContext } from "@/lib/utils/server/session";
import { canManagePage } from "@/lib/utils/server/permission";
import { deletePage } from "@/lib/utils/server/page";

const ctx = { params: Promise.resolve({ pageId: "p1" }) };

beforeEach(() => vi.clearAllMocks());

describe("DELETE /api/pages/[pageId]", () => {
  test("anonymous → 401", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost/api/pages/p1"), ctx);
    expect(res.status).toBe(401);
    expect(deletePage).not.toHaveBeenCalled();
  });

  test("editor → 403", async () => {
    vi.mocked(getSessionContext).mockResolvedValue({ userId: "u1" } as never);
    vi.mocked(canManagePage).mockResolvedValue(false);
    const res = await DELETE(new Request("http://localhost/api/pages/p1"), ctx);
    expect(res.status).toBe(403);
    expect(deletePage).not.toHaveBeenCalled();
  });

  test("admin → 200 and deletes inside a transaction", async () => {
    vi.mocked(getSessionContext).mockResolvedValue({ userId: "u1" } as never);
    vi.mocked(canManagePage).mockResolvedValue(true);
    vi.mocked(deletePage).mockResolvedValue([]);
    const res = await DELETE(new Request("http://localhost/api/pages/p1"), ctx);
    expect(res.status).toBe(200);
    expect(deletePage).toHaveBeenCalledWith("p1", expect.anything());
  });
});
