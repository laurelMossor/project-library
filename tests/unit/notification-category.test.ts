import { describe, test, expect } from "vitest";
import { NotificationType, NotificationCategory } from "@prisma/client";
import {
	NOTIFICATION_TYPE_TO_CATEGORY,
	CATEGORY_EMAIL_DEFAULT,
} from "@/lib/utils/server/notification-category";

describe("NOTIFICATION_TYPE_TO_CATEGORY", () => {
	test("covers every NotificationType (exhaustive)", () => {
		for (const type of Object.values(NotificationType)) {
			expect(NOTIFICATION_TYPE_TO_CATEGORY[type]).toBeDefined();
		}
	});

	test("groups requests (follow/join/approved) together", () => {
		expect(NOTIFICATION_TYPE_TO_CATEGORY[NotificationType.FOLLOW_REQUEST]).toBe(NotificationCategory.REQUESTS);
		expect(NOTIFICATION_TYPE_TO_CATEGORY[NotificationType.JOIN_REQUEST]).toBe(NotificationCategory.REQUESTS);
		expect(NOTIFICATION_TYPE_TO_CATEGORY[NotificationType.REQUEST_APPROVED]).toBe(NotificationCategory.REQUESTS);
	});

	test("groups passive follow activity under FOLLOWS", () => {
		expect(NOTIFICATION_TYPE_TO_CATEGORY[NotificationType.NEW_FOLLOWER]).toBe(NotificationCategory.FOLLOWS);
		expect(NOTIFICATION_TYPE_TO_CATEGORY[NotificationType.NEW_MEMBER]).toBe(NotificationCategory.FOLLOWS);
	});

	test("comments and RSVPs map to their own categories", () => {
		expect(NOTIFICATION_TYPE_TO_CATEGORY[NotificationType.COMMENT]).toBe(NotificationCategory.COMMENTS);
		expect(NOTIFICATION_TYPE_TO_CATEGORY[NotificationType.RSVP]).toBe(NotificationCategory.RSVPS);
	});
});

describe("CATEGORY_EMAIL_DEFAULT", () => {
	test("has a default for every category", () => {
		for (const cat of Object.values(NotificationCategory)) {
			expect(typeof CATEGORY_EMAIL_DEFAULT[cat]).toBe("boolean");
		}
	});

	test("actionable + direct engagement default on; passive + high-volume default off", () => {
		expect(CATEGORY_EMAIL_DEFAULT[NotificationCategory.COMMENTS]).toBe(true);
		expect(CATEGORY_EMAIL_DEFAULT[NotificationCategory.REQUESTS]).toBe(true);
		expect(CATEGORY_EMAIL_DEFAULT[NotificationCategory.MESSAGES]).toBe(true);
		expect(CATEGORY_EMAIL_DEFAULT[NotificationCategory.FOLLOWS]).toBe(false);
		expect(CATEGORY_EMAIL_DEFAULT[NotificationCategory.RSVPS]).toBe(false);
	});
});
