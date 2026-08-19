import { describe, test, expect } from "vitest";
import { getEventsWithCoords, getMappableEvents } from "@/lib/utils/collection";
import { eventPopupHtml } from "@/lib/components/map/eventPopupHtml";
import { formatDateTime, formatInstantAbsolute } from "@/lib/utils/datetime";
import { EVENT_DETAIL } from "@/lib/const/routes";
import type { EventItem } from "@/lib/types/event";
import type { PostCollectionItem } from "@/lib/types/post";

function makeEvent(overrides: Partial<EventItem> & Pick<EventItem, "id" | "eventDateTime">): EventItem {
	return {
		type: "event",
		userId: "u1",
		pageId: null,
		title: "Test",
		content: "Body",
		status: "PUBLISHED",
		contentVisibility: "LISTED",
		tags: [],
		topics: [],
		user: { id: "u1", handle: "test", displayName: "Test", firstName: null, lastName: null, avatarImageId: null },
		page: null,
		pinnedAt: null,
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-01"),
		eventTimezone: "America/Los_Angeles",
		location: "Somewhere",
		latitude: 45.5,
		longitude: -122.6,
		images: [],
		...overrides,
	};
}

describe("getEventsWithCoords", () => {
	test("includes events with lat/lng including past", () => {
		const past = makeEvent({
			id: "past",
			eventDateTime: new Date("2000-01-01"),
		});
		const items = [past];
		expect(getEventsWithCoords(items)).toHaveLength(1);
	});

	test("excludes events without coordinates", () => {
		const noCoords = makeEvent({
			id: "no-coords",
			eventDateTime: new Date("2099-06-01"),
			latitude: null,
			longitude: null,
		});
		expect(getEventsWithCoords([noCoords])).toHaveLength(0);
	});
});

describe("getMappableEvents", () => {
	test("excludes past events", () => {
		const past = makeEvent({
			id: "past",
			eventDateTime: new Date("2000-01-01"),
		});
		const upcoming = makeEvent({
			id: "upcoming",
			eventDateTime: new Date("2099-06-01"),
		});
		const result = getMappableEvents([past, upcoming]);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("upcoming");
	});

	test("returns empty when all located events are past", () => {
		const past1 = makeEvent({ id: "p1", eventDateTime: new Date("2000-01-01") });
		const past2 = makeEvent({ id: "p2", eventDateTime: new Date("2001-01-01") });
		expect(getMappableEvents([past1, past2])).toHaveLength(0);
	});

	test("ignores non-event collection items", () => {
		const post = {
			type: "post",
			id: "post1",
		} as PostCollectionItem;
		const upcoming = makeEvent({ id: "e1", eventDateTime: new Date("2099-06-01") });
		expect(getMappableEvents([post, upcoming])).toHaveLength(1);
	});
});

describe("eventPopupHtml", () => {
	test("escapes a hostile title and includes the formatted date", () => {
		const eventDateTime = new Date("2099-06-01T18:30:00Z");
		const html = eventPopupHtml({
			id: "evt-1",
			title: `Foo <img src=x onerror=alert(1)> "bar"`,
			eventDateTime,
			eventTimezone: "America/Los_Angeles",
		});

		expect(html).toContain("&lt;img");
		expect(html).toContain("&quot;bar&quot;");
		expect(html).not.toContain("<img");
		expect(html).toContain(`href="${EVENT_DETAIL("evt-1")}"`);
		expect(html).toContain(formatDateTime(eventDateTime, "America/Los_Angeles"));
	});

	test("falls back to formatInstantAbsolute when there is no timezone", () => {
		const eventDateTime = new Date("2099-06-01T18:30:00Z");
		const html = eventPopupHtml({
			id: "evt-2",
			title: "Untitled-ish",
			eventDateTime,
			eventTimezone: null,
		});

		expect(html).toContain(formatInstantAbsolute(eventDateTime));
	});
});
