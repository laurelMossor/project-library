/** The @handle parser shared by the comment server (who to notify) and CommentRow (what to bold). */
import { describe, test, expect } from "vitest";
import { extractMentionHandles, splitMentions } from "@/lib/utils/mentions";

describe("extractMentionHandles", () => {
	test("finds handles anywhere in the text, lowercased and de-duplicated", () => {
		expect(extractMentionHandles("@Sam hi, and @alice — @SAM again")).toEqual(["sam", "alice"]);
	});

	test("an email address is not a mention", () => {
		expect(extractMentionHandles("write bob@example.com")).toEqual([]);
	});

	test("trailing punctuation is trimmed off the handle", () => {
		expect(extractMentionHandles("thanks @sam. and @alice_, ok @bob-")).toEqual(["sam", "alice", "bob"]);
	});

	test("handle characters inside a handle are kept", () => {
		expect(extractMentionHandles("@secret.work_shop-2")).toEqual(["secret.work_shop-2"]);
	});

	test("a handle inside a URL path isn't a tag", () => {
		expect(extractMentionHandles("see https://medium.com/@sam.example/post or mailto:@alice")).toEqual([]);
	});

	test("mentions right after a newline, a bracket, or each other are found", () => {
		expect(extractMentionHandles("hi\n@sam (@alice) @bob,@carl")).toEqual(["sam", "alice", "bob", "carl"]);
	});

	test("too short or too long isn't a handle", () => {
		expect(extractMentionHandles("@ab and @" + "x".repeat(31))).toEqual([]);
	});
});

describe("splitMentions", () => {
	test("only known handles become mentions; the rest stays plain text", () => {
		expect(splitMentions("hi @Sam and @ghost.", new Set(["sam"]))).toEqual([
			{ kind: "text", text: "hi " },
			{ kind: "mention", text: "@Sam", handle: "sam" },
			{ kind: "text", text: " and @ghost." },
		]);
	});

	test("trailing punctuation stays outside the bold", () => {
		expect(splitMentions("@sam.", new Set(["sam"]))).toEqual([
			{ kind: "mention", text: "@sam", handle: "sam" },
			{ kind: "text", text: "." },
		]);
	});

	test("the boundary character before `@` stays in the text, not the bold", () => {
		expect(splitMentions("(@sam)\n@alice", new Set(["sam", "alice"]))).toEqual([
			{ kind: "text", text: "(" },
			{ kind: "mention", text: "@sam", handle: "sam" },
			{ kind: "text", text: ")\n" },
			{ kind: "mention", text: "@alice", handle: "alice" },
		]);
	});

	test("text with no mentions is one plain segment", () => {
		expect(splitMentions("no tags here", new Set(["sam"]))).toEqual([{ kind: "text", text: "no tags here" }]);
	});
});
