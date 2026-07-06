/**
 * Unit test for getConversationIdsForIdentity — the server-side identity scope for the inbox /
 * sent / conversation routes (findings #16/#25). Personal identity sees only the user's own
 * participant rows; a page identity sees only that page's. Prisma is mocked.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: { conversationParticipant: { findMany: vi.fn() } },
}));

import { getConversationIdsForIdentity } from "@/lib/utils/server/message";
import { prisma } from "@/lib/utils/server/prisma";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.conversationParticipant.findMany).mockResolvedValue([{ conversationId: "c1" }] as never);
});

describe("getConversationIdsForIdentity", () => {
  test("personal identity (no asPageId) scopes by userId only", async () => {
    await getConversationIdsForIdentity("u1", null);
    expect(prisma.conversationParticipant.findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      select: { conversationId: true },
    });
  });

  test("page identity scopes by pageId only — never the user's personal conversations", async () => {
    await getConversationIdsForIdentity("u1", "page-1");
    expect(prisma.conversationParticipant.findMany).toHaveBeenCalledWith({
      where: { pageId: "page-1" },
      select: { conversationId: true },
    });
  });

  test("returns the conversation ids", async () => {
    expect(await getConversationIdsForIdentity("u1", null)).toEqual(["c1"]);
  });
});
