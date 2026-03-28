import { describe, test, expect } from "vitest";
import {
  validateEmail,
  validateUsername,
  validatePassword,
  validateMessageContent,
  validatePostData,
  validateEventData,
  validatePageData,
} from "@/lib/validations";

// ---------------------------------------------------------------------------
// validateEmail
// ---------------------------------------------------------------------------
describe("validateEmail", () => {
  test("accepts a valid email", () => {
    expect(validateEmail("user@example.com")).toBe(true);
  });

  test("accepts email with subdomain", () => {
    expect(validateEmail("user@mail.example.com")).toBe(true);
  });

  test("rejects missing @", () => {
    expect(validateEmail("userexample.com")).toBe(false);
  });

  test("rejects missing domain", () => {
    expect(validateEmail("user@")).toBe(false);
  });

  test("rejects missing TLD", () => {
    expect(validateEmail("user@example")).toBe(false);
  });

  test("rejects empty string", () => {
    expect(validateEmail("")).toBe(false);
  });

  test("rejects whitespace-only", () => {
    expect(validateEmail("   ")).toBe(false);
  });

  test("rejects email with spaces", () => {
    expect(validateEmail("user @example.com")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateUsername
// ---------------------------------------------------------------------------
describe("validateUsername", () => {
  test("accepts exactly 3 characters (minimum)", () => {
    expect(validateUsername("abc")).toBe(true);
  });

  test("accepts exactly 20 characters (maximum)", () => {
    expect(validateUsername("a".repeat(20))).toBe(true);
  });

  test("rejects 2 characters (below minimum)", () => {
    expect(validateUsername("ab")).toBe(false);
  });

  test("rejects 21 characters (above maximum)", () => {
    expect(validateUsername("a".repeat(21))).toBe(false);
  });

  test("accepts letters, numbers, underscores, hyphens", () => {
    expect(validateUsername("user_name-123")).toBe(true);
  });

  test("rejects spaces", () => {
    expect(validateUsername("user name")).toBe(false);
  });

  test("rejects special characters", () => {
    expect(validateUsername("user@name")).toBe(false);
  });

  test("rejects empty string", () => {
    expect(validateUsername("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validatePassword
// ---------------------------------------------------------------------------
describe("validatePassword", () => {
  test("accepts exactly 8 characters (minimum)", () => {
    expect(validatePassword("12345678")).toBe(true);
  });

  test("accepts long passwords", () => {
    expect(validatePassword("a".repeat(100))).toBe(true);
  });

  test("rejects 7 characters (below minimum)", () => {
    expect(validatePassword("1234567")).toBe(false);
  });

  test("rejects empty string", () => {
    expect(validatePassword("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateMessageContent
// ---------------------------------------------------------------------------
describe("validateMessageContent", () => {
  test("accepts valid content", () => {
    expect(validateMessageContent("Hello there")).toEqual({ valid: true });
  });

  test("rejects empty string", () => {
    expect(validateMessageContent("")).toMatchObject({ valid: false });
  });

  test("rejects whitespace-only", () => {
    expect(validateMessageContent("   ")).toMatchObject({ valid: false });
  });

  test("rejects content over 5000 characters", () => {
    expect(validateMessageContent("a".repeat(5001))).toMatchObject({ valid: false });
  });

  test("accepts content at exactly 5000 characters", () => {
    expect(validateMessageContent("a".repeat(5000))).toEqual({ valid: true });
  });
});

// ---------------------------------------------------------------------------
// validatePostData
// ---------------------------------------------------------------------------
describe("validatePostData", () => {
  test("accepts valid post with content only", () => {
    expect(validatePostData({ content: "Some content" })).toEqual({ valid: true });
  });

  test("accepts post with optional title", () => {
    expect(validatePostData({ content: "Content", title: "My title" })).toEqual({ valid: true });
  });

  test("rejects missing content", () => {
    expect(validatePostData({ content: "" })).toMatchObject({ valid: false });
  });

  test("rejects content over 10000 characters", () => {
    expect(validatePostData({ content: "a".repeat(10001) })).toMatchObject({ valid: false });
  });

  test("rejects title over 150 characters", () => {
    expect(validatePostData({ content: "ok", title: "a".repeat(151) })).toMatchObject({ valid: false });
  });

  test("rejects more than 10 tags", () => {
    const tags = Array.from({ length: 11 }, (_, i) => `tag${i}`);
    expect(validatePostData({ content: "ok", tags })).toMatchObject({ valid: false });
  });

  test("rejects empty tag in array", () => {
    expect(validatePostData({ content: "ok", tags: ["valid", ""] })).toMatchObject({ valid: false });
  });
});

// ---------------------------------------------------------------------------
// validateEventData
// ---------------------------------------------------------------------------
describe("validateEventData", () => {
  const futureDate = new Date(Date.now() + 86_400_000); // tomorrow

  test("accepts valid event data", () => {
    expect(validateEventData({
      title: "My Event",
      content: "Event details",
      eventDateTime: futureDate,
      location: "Portland, OR",
    })).toEqual({ valid: true });
  });

  test("rejects missing title", () => {
    expect(validateEventData({
      title: "",
      content: "Details",
      eventDateTime: futureDate,
      location: "Portland, OR",
    })).toMatchObject({ valid: false });
  });

  test("rejects missing content", () => {
    expect(validateEventData({
      title: "Event",
      content: "",
      eventDateTime: futureDate,
      location: "Portland, OR",
    })).toMatchObject({ valid: false });
  });

  test("rejects past date", () => {
    expect(validateEventData({
      title: "Event",
      content: "Details",
      eventDateTime: new Date(2000, 1, 1),
      location: "Portland, OR",
    })).toMatchObject({ valid: false });
  });

  test("accepts empty location (location is optional)", () => {
    expect(validateEventData({
      title: "Event",
      content: "Details",
      eventDateTime: futureDate,
      location: "",
    })).toMatchObject({ valid: true });
  });

  test("rejects location over 255 characters", () => {
    expect(validateEventData({
      title: "Event",
      content: "Details",
      eventDateTime: futureDate,
      location: "a".repeat(256),
    })).toMatchObject({ valid: false });
  });

  test("rejects title over 150 characters", () => {
    expect(validateEventData({
      title: "a".repeat(151),
      content: "Details",
      eventDateTime: futureDate,
      location: "Portland, OR",
    })).toMatchObject({ valid: false });
  });

  test("rejects more than 10 tags", () => {
    const tags = Array.from({ length: 11 }, (_, i) => `tag${i}`);
    expect(validateEventData({
      title: "Event",
      content: "Details",
      eventDateTime: futureDate,
      location: "Portland, OR",
      tags,
    })).toMatchObject({ valid: false });
  });
});

// ---------------------------------------------------------------------------
// validatePageData
// ---------------------------------------------------------------------------
describe("validatePageData", () => {
  test("accepts valid page data", () => {
    expect(validatePageData({ name: "Portland Makers", slug: "portland-makers" })).toEqual({ valid: true });
  });

  test("rejects missing name", () => {
    expect(validatePageData({ name: "", slug: "portland-makers" })).toMatchObject({ valid: false });
  });

  test("rejects missing slug", () => {
    expect(validatePageData({ name: "Portland Makers", slug: "" })).toMatchObject({ valid: false });
  });

  test("rejects slug shorter than 3 characters", () => {
    expect(validatePageData({ name: "PM", slug: "pm" })).toMatchObject({ valid: false });
  });

  test("rejects slug with uppercase letters", () => {
    expect(validatePageData({ name: "Portland Makers", slug: "Portland-Makers" })).toMatchObject({ valid: false });
  });

  test("rejects slug with spaces", () => {
    expect(validatePageData({ name: "Portland Makers", slug: "portland makers" })).toMatchObject({ valid: false });
  });

  test("rejects slug starting with a hyphen", () => {
    expect(validatePageData({ name: "Portland Makers", slug: "-portland" })).toMatchObject({ valid: false });
  });

  test("rejects slug ending with a hyphen", () => {
    expect(validatePageData({ name: "Portland Makers", slug: "portland-" })).toMatchObject({ valid: false });
  });

  test("rejects slug over 50 characters", () => {
    expect(validatePageData({ name: "Long", slug: "a".repeat(51) })).toMatchObject({ valid: false });
  });
});
