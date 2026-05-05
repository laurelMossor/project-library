import { describe, test, expect } from "vitest";
import {
  validateEmail,
  validateHandle,
  validatePassword,
  validateMessageContent,
  validatePostData,
  validateEventData,
  validatePageData,
} from "@/lib/validations";
import { generateHandle } from "@/lib/utils/handle";

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
// validateHandle (strict — does NOT normalize)
// ---------------------------------------------------------------------------
describe("validateHandle", () => {
  test("accepts exactly 3 characters (minimum)", () => {
    expect(validateHandle("abc")).toBe(true);
  });

  test("accepts exactly 30 characters (maximum)", () => {
    expect(validateHandle("a".repeat(30))).toBe(true);
  });

  test("rejects 2 characters (below minimum)", () => {
    expect(validateHandle("ab")).toBe(false);
  });

  test("rejects 31 characters (above maximum)", () => {
    expect(validateHandle("a".repeat(31))).toBe(false);
  });

  test("accepts lowercase alphanumeric, underscores, hyphens", () => {
    expect(validateHandle("user_name-123")).toBe(true);
  });

  test("rejects uppercase letters (must be normalized first)", () => {
    expect(validateHandle("UserName")).toBe(false);
  });

  test("rejects spaces", () => {
    expect(validateHandle("user name")).toBe(false);
  });

  test("rejects special characters", () => {
    expect(validateHandle("user@name")).toBe(false);
  });

  test("rejects empty string", () => {
    expect(validateHandle("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateHandle (forgiving — normalizes free-text input into a candidate)
// ---------------------------------------------------------------------------
describe("generateHandle", () => {
  test("lowercases input", () => {
    expect(generateHandle("Spats Improv")).toBe("spats-improv");
  });

  test("strips special characters by replacing with hyphens", () => {
    expect(generateHandle("Mary's Pottery!")).toBe("mary-s-pottery");
  });

  test("collapses runs of hyphens", () => {
    expect(generateHandle("foo   bar")).toBe("foo-bar");
    expect(generateHandle("foo!!!bar")).toBe("foo-bar");
  });

  test("trims leading/trailing hyphens and underscores", () => {
    expect(generateHandle("---foo---")).toBe("foo");
    expect(generateHandle("___foo___")).toBe("foo");
    expect(generateHandle("-_-foo-_-")).toBe("foo");
  });

  test("preserves underscores in the middle", () => {
    expect(generateHandle("user_name")).toBe("user_name");
  });

  test("preserves digits", () => {
    expect(generateHandle("user123")).toBe("user123");
  });

  test("caps at 30 characters", () => {
    expect(generateHandle("a".repeat(50))).toBe("a".repeat(30));
  });

  test("output of generateHandle on reasonable input passes validateHandle", () => {
    const candidate = generateHandle("Portland Makers Guild");
    expect(candidate).toBe("portland-makers-guild");
    expect(validateHandle(candidate)).toBe(true);
  });

  test("can produce strings shorter than the validator minimum (caller must check)", () => {
    // generateHandle is forgiving; callers pair it with validateHandle.
    expect(generateHandle("!!")).toBe("");
    expect(validateHandle(generateHandle("!!"))).toBe(false);
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

  test("rejects missing location", () => {
    expect(validateEventData({
      title: "Event",
      content: "Details",
      eventDateTime: futureDate,
      location: "",
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
    expect(validatePageData({ name: "Portland Makers", handle: "portland-makers" })).toEqual({ valid: true });
  });

  test("rejects missing name", () => {
    expect(validatePageData({ name: "", handle: "portland-makers" })).toMatchObject({ valid: false });
  });

  test("rejects missing handle", () => {
    expect(validatePageData({ name: "Portland Makers", handle: "" })).toMatchObject({ valid: false });
  });

  test("rejects handle shorter than 3 characters", () => {
    expect(validatePageData({ name: "PM", handle: "pm" })).toMatchObject({ valid: false });
  });

  test("rejects handle with uppercase letters", () => {
    expect(validatePageData({ name: "Portland Makers", handle: "Portland-Makers" })).toMatchObject({ valid: false });
  });

  test("rejects handle with spaces", () => {
    expect(validatePageData({ name: "Portland Makers", handle: "portland makers" })).toMatchObject({ valid: false });
  });

  test("rejects handle over 30 characters", () => {
    expect(validatePageData({ name: "Long", handle: "a".repeat(31) })).toMatchObject({ valid: false });
  });

  // Note: leading/trailing hyphens are now allowed by the unified validateHandle
  // regex (matches `[a-z0-9_-]{3,30}`). Callers that want strict no-edge-hyphen
  // semantics should normalize input via generateHandle first, which strips them.
  test("accepts handle with leading hyphen (unified validator allows it)", () => {
    expect(validatePageData({ name: "Portland Makers", handle: "-portland" })).toEqual({ valid: true });
  });

  test("rejects reserved handle (matches RESERVED_HANDLES)", () => {
    const result = validatePageData({ name: "Explore", handle: "explore" });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/reserved/i);
  });

  test("rejects reserved single-letter handle", () => {
    expect(validatePageData({ name: "P", handle: "p" })).toMatchObject({ valid: false });
  });

  test("rejects reserved handle case-insensitively (after format check)", () => {
    // "API" fails format (uppercase), so this just exercises the format gate;
    // included to document that validateHandle runs before isReservedHandle.
    expect(validatePageData({ name: "Api", handle: "API" })).toMatchObject({ valid: false });
  });
});
