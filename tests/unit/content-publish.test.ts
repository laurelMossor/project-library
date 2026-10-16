/**
 * The shared post/event publish rules: publishing is one-way (content-status.ts), and only top-level
 * content in a page tells the page's members (content-activity.ts).
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/activity", () => ({ emitActivity: vi.fn() }));
vi.mock("@/lib/utils/server/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));

import { assertStatusTransition } from "@/lib/utils/server/content-status";
import { notifyPageActivity } from "@/lib/utils/server/content-activity";
import { emitActivity } from "@/lib/utils/server/activity";
import { DomainError } from "@/lib/utils/server/domain-error";

const emit = vi.mocked(emitActivity);

beforeEach(() => vi.clearAllMocks());

describe("assertStatusTransition", () => {
	test("draft → published publishes", () => {
		expect(assertStatusTransition("DRAFT", "PUBLISHED")).toEqual({ publishes: true });
	});

	test("born published (create) publishes; born draft doesn't", () => {
		expect(assertStatusTransition(null, "PUBLISHED")).toEqual({ publishes: true });
		expect(assertStatusTransition(null, "DRAFT")).toEqual({ publishes: false });
	});

	test("re-saving a published item, or leaving status alone, doesn't publish again", () => {
		expect(assertStatusTransition("PUBLISHED", "PUBLISHED")).toEqual({ publishes: false });
		expect(assertStatusTransition("PUBLISHED", undefined)).toEqual({ publishes: false });
		expect(assertStatusTransition("DRAFT", undefined)).toEqual({ publishes: false });
	});

	test("published → draft is refused", () => {
		expect(() => assertStatusTransition("PUBLISHED", "DRAFT")).toThrow(DomainError);
	});
});

describe("notifyPageActivity", () => {
	const content = { id: "p1", userId: "alice", pageId: "pageY", asPageId: null };

	test("a top-level post in a page tells the page, spoken by the author", async () => {
		await notifyPageActivity("POST", content, "alice");
		expect(emit).toHaveBeenCalledWith(
			"content.published",
			{ type: "USER", id: "alice" },
			{ type: "PAGE", id: "pageY" },
			{ type: "POST", id: "p1" },
			{ authorUserId: "alice" },
		);
	});

	test("posting as the page makes the page the actor", async () => {
		await notifyPageActivity("EVENT", { ...content, asPageId: "pageY" }, "alice");
		expect(emit.mock.calls[0][1]).toEqual({ type: "PAGE", id: "pageY" });
	});

	test("an editor publishing a page-voiced draft is the one excluded, not the stored author", async () => {
		await notifyPageActivity("POST", { ...content, asPageId: "pageY" }, "bob");
		expect(emit).toHaveBeenCalledWith(
			"content.published",
			{ type: "PAGE", id: "pageY" },
			{ type: "PAGE", id: "pageY" },
			{ type: "POST", id: "p1" },
			{ authorUserId: "bob" },
		);
	});

	test("content not in a page, or an update, tells nobody", async () => {
		await notifyPageActivity("POST", { ...content, pageId: null }, "alice");
		await notifyPageActivity("POST", { ...content, parentPostId: "parent" }, "alice");
		await notifyPageActivity("POST", { ...content, eventId: "e1" }, "alice");
		expect(emit).not.toHaveBeenCalled();
	});
});
