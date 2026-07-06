/**
 * Unit tests for the PRIVATE-profile + LISTED-content guard (finding 6). The guard is evaluated on
 * the MERGED (stored + incoming) state so a partial save that changes only one field can't slip the
 * invalid pair past it. Prisma is mocked.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { ProfileVisibility, ContentVisibility } from "@prisma/client";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() }, page: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/user", () => ({ updateUserProfile: vi.fn(), personalProfileFields: {} }));
vi.mock("@/lib/utils/server/page", () => ({ updatePageProfile: vi.fn(), publicPageFields: {} }));
vi.mock("@/lib/utils/server/profile-element", () => ({ processElementsPayload: vi.fn() }));
vi.mock("@/lib/utils/server/requests", () => ({ autoApprovePendingOnUnlock: vi.fn() }));

import { assertProfileContentPairing } from "@/lib/utils/server/profile-update";
import { prisma } from "@/lib/utils/server/prisma";

const stored = (profileVisibility: ProfileVisibility, contentVisibility: ContentVisibility) =>
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ profileVisibility, contentVisibility } as never);

beforeEach(() => vi.clearAllMocks());

describe("assertProfileContentPairing", () => {
  test("rejects PRIVATE profile + LISTED content when both are in the payload", async () => {
    const err = await assertProfileContentPairing("USER", "u1", {
      profileVisibility: ProfileVisibility.PRIVATE,
      contentVisibility: ContentVisibility.LISTED,
    });
    expect(err).toMatch(/private profile/i);
  });

  test("rejects a partial save that sets content LISTED while the stored profile is PRIVATE", async () => {
    stored(ProfileVisibility.PRIVATE, ContentVisibility.PRIVATE);
    const err = await assertProfileContentPairing("USER", "u1", { contentVisibility: ContentVisibility.LISTED });
    expect(err).toMatch(/private profile/i);
  });

  test("rejects a partial save that sets profile PRIVATE while the stored content is LISTED", async () => {
    stored(ProfileVisibility.PUBLIC, ContentVisibility.LISTED);
    const err = await assertProfileContentPairing("USER", "u1", { profileVisibility: ProfileVisibility.PRIVATE });
    expect(err).toMatch(/private profile/i);
  });

  test("allows PRIVATE profile + UNLISTED content", async () => {
    const err = await assertProfileContentPairing("USER", "u1", {
      profileVisibility: ProfileVisibility.PRIVATE,
      contentVisibility: ContentVisibility.UNLISTED,
    });
    expect(err).toBeNull();
  });

  test("allows PUBLIC profile + LISTED content", async () => {
    const err = await assertProfileContentPairing("USER", "u1", {
      profileVisibility: ProfileVisibility.PUBLIC,
      contentVisibility: ContentVisibility.LISTED,
    });
    expect(err).toBeNull();
  });

  test("no visibility fields in the payload → no DB read, no error", async () => {
    const err = await assertProfileContentPairing("USER", "u1", { headline: "hi" });
    expect(err).toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
