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
