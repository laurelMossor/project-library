import { describe, test, expect } from "vitest";
import { conversationTitle } from "@/lib/components/messages/conversation-display";
import { commentIdentity, type CommentItem } from "@/lib/types/comment";

describe("conversationTitle", () => {
  test("names a deleted counterpart instead of falling through to Conversation", () => {
    const base = {
      kind: "DIRECT" as const,
      name: null,
      members: [{ isYou: true, type: "user" as const, id: "me", user: null }],
    };
    expect(conversationTitle({ ...base, deletedCounterpart: "USER" })).toBe("[user deleted]");
    expect(conversationTitle({ ...base, deletedCounterpart: "PAGE" })).toBe("[page deleted]");
  });
});

describe("commentIdentity", () => {
  test("returns null for a tombstone so the row does not render the person", () => {
    const comment = {
      deleted: "PAGE",
      asPage: null,
      author: { id: "u1", handle: "alice", displayName: "Alice", avatarImageId: null, firstName: "Alice", lastName: null },
    } as CommentItem;
    expect(commentIdentity(comment)).toBeNull();
  });
});
