import { describe, test, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFilter } from "@/lib/hooks/useFilter";
import type { EventItem } from "@/lib/types/event";
import type { PostCollectionItem } from "@/lib/types/post";
import type { CollectionItem } from "@/lib/types/collection";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER = {
  id: "u1",
  handle: "alice",
  displayName: "Alice",
  firstName: "Alice",
  lastName: null,
  avatarImageId: null,
};

function makeEvent(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "ev1",
    userId: "u1",
    type: "event",
    title: "Test Event",
    content: "Event content",
    tags: [],
    topics: [],
    user: USER,
    page: null,
    pinnedAt: null,
    createdAt: new Date("2024-06-01"),
    updatedAt: new Date("2024-06-01"),
    eventDateTime: new Date("2024-07-01"),
    location: "Portland, OR",
    latitude: null,
    longitude: null,
    status: "PUBLISHED",
    images: [],
    ...overrides,
  };
}

function makePost(overrides: Partial<PostCollectionItem> = {}): PostCollectionItem {
  return {
    id: "p1",
    userId: "u1",
    type: "post",
    title: "Test Post",
    content: "Post content",
    tags: [],
    topics: [],
    user: USER,
    page: null,
    createdAt: new Date("2024-05-01"),
    updatedAt: new Date("2024-05-01"),
    eventId: null,
    parentPostId: null,
    pinnedAt: null,
    images: [],
    ...overrides,
  };
}

// Sort order uses eventDateTime for events, createdAt for posts.
// ev1 eventDateTime Jul → newest; ev2 eventDateTime Apr; p1 createdAt May; p2 createdAt Mar → oldest
const ITEMS: CollectionItem[] = [
  makeEvent({ id: "ev1", tags: ["tech", "community"], eventDateTime: new Date("2024-07-01") }),
  makeEvent({ id: "ev2", tags: ["art"], eventDateTime: new Date("2024-04-01") }),
  makePost({ id: "p1", tags: ["tech"], createdAt: new Date("2024-05-01") }),
  makePost({ id: "p2", tags: [], createdAt: new Date("2024-03-01") }),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useFilter", () => {
  test("returns all items when no filters set", () => {
    const { result } = renderHook(() => useFilter(ITEMS));
    expect(result.current.filteredItems).toHaveLength(4);
  });

  test("filters to event type only", () => {
    const { result } = renderHook(() => useFilter(ITEMS));
    act(() => result.current.setCollectionTypeFilter("event"));
    expect(result.current.filteredItems.every((i) => i.type === "event")).toBe(true);
    expect(result.current.filteredItems).toHaveLength(2);
  });

  test("filters to post type only", () => {
    const { result } = renderHook(() => useFilter(ITEMS));
    act(() => result.current.setCollectionTypeFilter("post"));
    expect(result.current.filteredItems.every((i) => i.type === "post")).toBe(true);
    expect(result.current.filteredItems).toHaveLength(2);
  });

  test("tag filter includes only items with matching tag", () => {
    const { result } = renderHook(() => useFilter(ITEMS));
    act(() => result.current.setSelectedTags(["tech"]));
    const ids = result.current.filteredItems.map((i) => i.id);
    expect(ids).toContain("ev1");
    expect(ids).toContain("p1");
    expect(ids).not.toContain("ev2");
    expect(ids).not.toContain("p2");
  });

  // Sort uses eventDateTime for events, createdAt for posts.
  // Newest order: ev1(Jul), p1(May), ev2(Apr), p2(Mar)
  test("sort newest orders by display date descending", () => {
    const { result } = renderHook(() => useFilter(ITEMS, { sort: "newest" }));
    expect(result.current.filteredItems.map((i) => i.id)).toEqual(["ev1", "p1", "ev2", "p2"]);
  });

  test("sort oldest orders by display date ascending", () => {
    const { result } = renderHook(() => useFilter(ITEMS));
    act(() => result.current.setSort("oldest"));
    expect(result.current.filteredItems.map((i) => i.id)).toEqual(["p2", "ev2", "p1", "ev1"]);
  });

  test("availableTags is the deduplicated union of all item tags", () => {
    const { result } = renderHook(() => useFilter(ITEMS));
    expect(result.current.availableTags.sort()).toEqual(["art", "community", "tech"]);
  });

  test("type + tag filters compose", () => {
    const { result } = renderHook(() => useFilter(ITEMS));
    act(() => {
      result.current.setCollectionTypeFilter("event");
      result.current.setSelectedTags(["tech"]);
    });
    const ids = result.current.filteredItems.map((i) => i.id);
    expect(ids).toEqual(["ev1"]);
  });

  test("initialValues.collectionType is applied on first render", () => {
    const { result } = renderHook(() => useFilter(ITEMS, { collectionType: "post" }));
    expect(result.current.filteredItems.every((i) => i.type === "post")).toBe(true);
  });
});
