/**
 * Truth tables for the shared draft-content predicates (src/lib/utils/content.ts).
 * These encode the "a post/event is valid with any single element" rule that the
 * publish gate, draft-preservation cleanup, and server route all share.
 */
import { describe, test, expect } from "vitest";
import { postHasContent, eventHasContent } from "@/lib/utils/content";

describe("postHasContent", () => {
	test("false when title, body, and images are all empty", () => {
		expect(postHasContent({ title: "", content: "", imageCount: 0 })).toBe(false);
		expect(postHasContent({ title: null, content: null })).toBe(false);
		expect(postHasContent({ title: "   ", content: "  " })).toBe(false); // whitespace-only
	});

	test("true for title-only, body-only, or image-only", () => {
		expect(postHasContent({ title: "Hello", content: "" })).toBe(true);
		expect(postHasContent({ title: "", content: "Body" })).toBe(true);
		expect(postHasContent({ title: "", content: "", imageCount: 1 })).toBe(true);
	});
});

describe("eventHasContent", () => {
	test("false when title, body, location, and images are all empty", () => {
		expect(eventHasContent({ title: "", content: "", location: null, imageCount: 0 })).toBe(false);
		expect(eventHasContent({})).toBe(false);
	});

	test("true for any single populated field", () => {
		expect(eventHasContent({ title: "Party" })).toBe(true);
		expect(eventHasContent({ content: "Details" })).toBe(true);
		expect(eventHasContent({ location: "Berkeley, CA" })).toBe(true);
		expect(eventHasContent({ imageCount: 1 })).toBe(true);
	});
});
