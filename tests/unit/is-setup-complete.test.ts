/**
 * isSetupComplete is the gate the setup-delete route refuses on.
 * A finished account must not look unfinished.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import { isSetupComplete } from "@/lib/utils/server/user";
import { prisma } from "@/lib/utils/server/prisma";

beforeEach(() => vi.clearAllMocks());

describe("isSetupComplete", () => {
  test("missing user → null", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
    expect(await isSetupComplete("missing")).toBeNull();
  });

  test("unfinished → false", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ setupCompletedAt: null } as never);
    expect(await isSetupComplete("u1")).toBe(false);
  });

  test("finished → true", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ setupCompletedAt: new Date() } as never);
    expect(await isSetupComplete("u1")).toBe(true);
  });
});
