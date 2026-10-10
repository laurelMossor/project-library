/** notificationHref — comment and mention notifications land on the comment itself. */
import { describe, test, expect } from "vitest";
import { notificationHref } from "@/lib/utils/notification-href";

describe("notificationHref comment anchors", () => {
	test("a mention links to the post, naming the comment to land on", () => {
		expect(notificationHref({ type: "MENTION", objectType: "POST", objectId: "p1", commentId: "c1", actorHandle: "alice" }))
			.toBe("/posts/p1?comment=c1");
	});

	test("an event comment links to the event, naming the comment", () => {
		expect(notificationHref({ type: "COMMENT", objectType: "EVENT", objectId: "e1", commentId: "c2", actorHandle: null }))
			.toBe("/events/e1?comment=c2");
	});

	test("an older comment notification without a comment id still links to the post", () => {
		expect(notificationHref({ type: "COMMENT", objectType: "POST", objectId: "p1", commentId: null, actorHandle: null }))
			.toBe("/posts/p1");
	});
});
