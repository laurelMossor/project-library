/**
 * Unit tests for getActingIdentity — the server-side resolver the root layout hands to
 * ActiveProfileProvider as props. Verifies the auth gate, that the active page is re-checked
 * with canPostAsPage (activePageId comes from the client-settable JWT), and the null cases.
 * Prisma, permission, and auth are mocked.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    page: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/utils/server/permission", () => ({ canPostAsPage: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { getActingIdentity } from "@/lib/utils/server/session";
import { prisma } from "@/lib/utils/server/prisma";
import { canPostAsPage } from "@/lib/utils/server/permission";

const user = { id: "user-1", handle: "alice", displayName: "Alice", avatarImageId: null, avatarImage: null };
const page = { id: "page-1", name: "Makers", handle: "makers", avatarImageId: null, avatarImage: null };

function session(userId: string | null, activePageId: string | null = null): Session | null {
  if (!userId) return null;
  return { user: { id: userId, activePageId } } as unknown as Session;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
  vi.mocked(prisma.page.findUnique).mockResolvedValue(page as never);
  vi.mocked(canPostAsPage).mockResolvedValue(true as never);
});

describe("getActingIdentity", () => {
  test("unauthenticated session → both null, no DB calls", async () => {
    const result = await getActingIdentity(session(null));
    expect(result).toEqual({ currentUser: null, activePage: null });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.page.findUnique).not.toHaveBeenCalled();
  });

  test("authenticated, no activePageId → currentUser resolved, activePage null, no permission check", async () => {
    const result = await getActingIdentity(session("user-1", null));
    expect(result.currentUser).toEqual(user);
    expect(result.activePage).toBeNull();
    expect(canPostAsPage).not.toHaveBeenCalled();
    expect(prisma.page.findUnique).not.toHaveBeenCalled();
  });

  test("activePageId set and permitted → active page resolved", async () => {
    const result = await getActingIdentity(session("user-1", "page-1"));
    expect(canPostAsPage).toHaveBeenCalledWith("user-1", "page-1");
    expect(result.currentUser).toEqual(user);
    expect(result.activePage).toEqual(page);
  });

  test("activePageId set but NOT permitted → active page is null, page never fetched", async () => {
    vi.mocked(canPostAsPage).mockResolvedValue(false as never);
    const result = await getActingIdentity(session("user-1", "page-1"));
    expect(canPostAsPage).toHaveBeenCalledWith("user-1", "page-1");
    expect(result.activePage).toBeNull();
    expect(prisma.page.findUnique).not.toHaveBeenCalled();
    expect(result.currentUser).toEqual(user); // user still resolves
  });
});
