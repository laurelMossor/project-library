import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: { user: { update: vi.fn() } },
}));

import { POST } from "@/app/api/me/setup-complete/route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/utils/server/prisma";

beforeEach(() => vi.clearAllMocks());

describe("POST /api/me/setup-complete", () => {
  test("anonymous → 401", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await POST();
    expect(res.status).toBe(401);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test("marks the signed-in user complete", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    const res = await POST();
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { setupCompletedAt: expect.any(Date) },
    });
  });
});
