import { describe, test, expect } from "vitest";
import { notificationPrompt, notificationText } from "@/lib/utils/notification-text";

describe("notificationText MEMBER_INVITE", () => {
	test("names the page and the offered role with a/an", () => {
		expect(notificationText({ type: "MEMBER_INVITE", actorName: "North Hall", objectTitle: "Admin" }))
			.toBe("North Hall invited you to be an Admin on their page");
		expect(notificationText({ type: "MEMBER_INVITE", actorName: "North Hall", objectTitle: "Editor" }))
			.toBe("North Hall invited you to be an Editor on their page");
		expect(notificationText({ type: "MEMBER_INVITE", actorName: "North Hall", objectTitle: "Member" }))
			.toBe("North Hall invited you to be a Member on their page");
	});

	test("an invite with no stored role still addresses the recipient", () => {
		expect(notificationText({ type: "MEMBER_INVITE", actorName: "North Hall" }))
			.toBe("North Hall invited you to join their page");
	});

	test("a membership invite asks the recipient to approve or decline", () => {
		expect(notificationPrompt("MEMBER_INVITE")).toBe("Approve or Decline?");
		expect(notificationPrompt("FOLLOW_REQUEST")).toBeNull();
	});
});

describe("notificationText PAGE_ACTIVITY", () => {
	const base = { type: "PAGE_ACTIVITY", actorName: "alice" } as const;

	test("an untitled post names the page", () => {
		expect(notificationText({ ...base, objectType: "POST", objectPageName: "Weaving Class" }))
			.toBe("alice posted in Weaving Class");
	});

	test("a titled post names the title, then the page", () => {
		expect(notificationText({ ...base, objectType: "POST", objectPageName: "Weaving Class", objectTitle: "Week 3" }))
			.toBe("alice posted “Week 3” in Weaving Class");
	});

	test("the page posting as itself says it posted to the page", () => {
		const asPage = { type: "PAGE_ACTIVITY", actorName: "Weaving Class", objectType: "POST" } as const;
		expect(notificationText(asPage)).toBe("Weaving Class posted to the page");
		expect(notificationText({ ...asPage, objectTitle: "Week 3" })).toBe("Weaving Class posted “Week 3” to the page");
	});

	test("an event is added to the page's events", () => {
		expect(notificationText({ ...base, objectType: "EVENT", objectPageName: "Weaving Class", objectTitle: "Open loom night" }))
			.toBe("alice added “Open loom night” to Weaving Class’s events");
		expect(notificationText({ ...base, objectType: "EVENT", objectPageName: "Weaving Class" }))
			.toBe("alice added an event to Weaving Class");
	});

	test("the page adding its own event", () => {
		expect(notificationText({ type: "PAGE_ACTIVITY", actorName: "Weaving Class", objectType: "EVENT", objectTitle: "Open loom night" }))
			.toBe("Weaving Class added the event “Open loom night”");
	});
});

describe("notificationText MENTION", () => {
	test("says who tagged you, in plain words", () => {
		expect(notificationText({ type: "MENTION", actorName: "alice", objectType: "POST", objectTitle: "Loom" }))
			.toBe("alice tagged you in a comment");
	});

	test("names the page when the recipient is a page", () => {
		expect(notificationText({ type: "MENTION", actorName: "alice", recipientPageName: "Portland Makers Guild" }))
			.toBe("alice tagged Portland Makers Guild in a comment");
	});
});
