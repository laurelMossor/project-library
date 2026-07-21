/**
 * Route + query-layer tests for notifications. Mocks prisma + session and asserts the security
 * boundary: every read/write is scoped to the session user's recipientUserId and the requested
 * context. Also covers reliable RSVP create-detection.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		notification: { findMany: vi.fn(), groupBy: vi.fn(), updateMany: vi.fn() },
		user: { findMany: vi.fn() },
		page: { findMany: vi.fn() },
		post: { findMany: vi.fn() },
		event: { findMany: vi.fn() },
		rsvp: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
		// getViewerContext reads permissions; the visibility title-gate reads follow edges.
		permission: { findMany: vi.fn() },
		follow: { findFirst: vi.fn() },
	},
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));

import { GET as listGET } from "@/app/api/notifications/route";
import { GET as countGET } from "@/app/api/notifications/unread-count/route";
import { PATCH as readPATCH } from "@/app/api/notifications/read/route";
import { getNotificationsForUser } from "@/lib/utils/server/notification";
import { createOrUpdateRsvp } from "@/lib/utils/server/rsvp";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";

const notif = vi.mocked(prisma.notification);
const rsvp = vi.mocked(prisma.rsvp);

function asUser(userId: string | null) {
	vi.mocked(getSessionContext).mockResolvedValue(userId ? { userId, activePageId: null } : (null as never));
}

beforeEach(() => {
	vi.clearAllMocks();
	notif.findMany.mockResolvedValue([] as never);
	notif.groupBy.mockResolvedValue([] as never);
	notif.updateMany.mockResolvedValue({ count: 0 } as never);
	// getViewerContext → no managed pages; follow edges → none, unless a test overrides.
	vi.mocked(prisma.permission.findMany).mockResolvedValue([] as never);
	vi.mocked(prisma.follow.findFirst).mockResolvedValue(null as never);
	vi.mocked(prisma.event.findMany).mockResolvedValue([] as never);
});

describe("notification routes — auth + scoping", () => {
	test("unread-count 401 when anonymous", async () => {
		asUser(null);
		expect((await countGET()).status).toBe(401);
	});

	test("list is scoped to the session user; personal context → contextPageId null", async () => {
		asUser("me");
		await listGET(new Request("http://x/api/notifications?context=personal"));
		expect(notif.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { recipientUserId: "me", contextPageId: null } }),
		);
	});

	test("list with a page context scopes to that page", async () => {
		asUser("me");
		await listGET(new Request("http://x/api/notifications?context=pageY"));
		expect(notif.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { recipientUserId: "me", contextPageId: "pageY" } }),
		);
	});

	test("mark-read only touches the caller's own unread rows for the given context", async () => {
		asUser("me");
		const req = new Request("http://x/api/notifications/read", {
			method: "PATCH",
			body: JSON.stringify({ context: "pageY" }),
		});
		await readPATCH(req);
		expect(notif.updateMany).toHaveBeenCalledWith({
			where: { recipientUserId: "me", contextPageId: "pageY", readAt: null },
			data: { readAt: expect.any(Date) },
		});
	});

	test("mark-read 401 when anonymous", async () => {
		asUser(null);
		const req = new Request("http://x/api/notifications/read", { method: "PATCH", body: "{}" });
		expect((await readPATCH(req)).status).toBe(401);
	});
});

describe("getNotificationsForUser — object-title visibility gate", () => {
	test("drops the title of an object the recipient can't view; passes a viewable one", async () => {
		const viewer = { userId: "me", memberPageIds: [] };
		const row = (id: string, objectId: string) => ({
			id, createdAt: new Date(), readAt: null, type: "COMMENT",
			actorUserId: null, actorPageId: null, actorName: "x", objectType: "POST", objectId,
		});
		notif.findMany.mockResolvedValue([row("n1", "mine"), row("n2", "secret")] as never);
		vi.mocked(prisma.post.findMany).mockResolvedValue([
			// Owned + LISTED → viewable, title passes through.
			{ id: "mine", userId: "me", pageId: null, eventId: null, contentVisibility: "LISTED", title: "My Post" },
			// Another user's PRIVATE post, no follow edge → not viewable, title dropped.
			{ id: "secret", userId: "other", pageId: null, eventId: null, contentVisibility: "PRIVATE", title: "Secret" },
		] as never);

		const items = await getNotificationsForUser("me", "personal", viewer);
		const byId = Object.fromEntries(items.map((i) => [i.id, i.objectTitle]));
		expect(byId.n1).toBe("My Post");
		expect(byId.n2).toBeNull();
	});
});

describe("createOrUpdateRsvp create-detection", () => {
	test("returns created=true for a brand-new RSVP", async () => {
		rsvp.findUnique.mockResolvedValue(null as never);
		rsvp.create.mockResolvedValue({ id: "r1" } as never);
		const { created } = await createOrUpdateRsvp("ev1", { name: "A", email: "A@x.com", status: "GOING" } as never);
		expect(created).toBe(true);
		expect(rsvp.create).toHaveBeenCalled();
		expect(rsvp.update).not.toHaveBeenCalled();
	});

	test("returns created=false when the RSVP already exists", async () => {
		rsvp.findUnique.mockResolvedValue({ id: "r1" } as never);
		rsvp.update.mockResolvedValue({ id: "r1" } as never);
		const { created } = await createOrUpdateRsvp("ev1", { name: "A", email: "A@x.com", status: "MAYBE" } as never);
		expect(created).toBe(false);
		expect(rsvp.update).toHaveBeenCalled();
		expect(rsvp.create).not.toHaveBeenCalled();
	});
});
