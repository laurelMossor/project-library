/**
 * Unit tests for the activity-notification dispatcher (activity.ts). Mocks ONLY prisma + the email
 * enqueue seam and lets the real fan-out logic run: action → type mapping, per-type role targeting
 * (ADMIN-only for request types), contextPageId tagging, self-drop, failure isolation, and that each
 * created notification enqueues a matching email (same recipients, mapped category).
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		permission: { findMany: vi.fn() },
		notification: { createManyAndReturn: vi.fn() },
		// Read only by the MENTION visibility gate (the real visibility layer runs).
		post: { findUnique: vi.fn() },
		event: { findUnique: vi.fn() },
		follow: { findFirst: vi.fn() },
	},
}));
vi.mock("@/lib/utils/server/email-outbox", () => ({ enqueueEmails: vi.fn() }));
// activity.ts → notification.ts → visibility.ts pulls the auth chain at import; the dispatcher never
// touches the session, so stub the module to keep this suite isolated (mirrors notification-routes).
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));

import { emitActivity } from "@/lib/utils/server/activity";
import { prisma } from "@/lib/utils/server/prisma";
import { enqueueEmails } from "@/lib/utils/server/email-outbox";

const createManyAndReturn = vi.mocked(prisma.notification.createManyAndReturn);
const permFindMany = vi.mocked(prisma.permission.findMany);
const enqueue = vi.mocked(enqueueEmails);

function pageManagers(managers: { userId: string; role: "ADMIN" | "EDITOR" | "MEMBER" }[]) {
	permFindMany.mockResolvedValue(managers as never);
}

/** The `data` rows from the most recent createManyAndReturn call. */
function writtenRows(): any[] {
	const call = createManyAndReturn.mock.calls.at(-1)?.[0] as { data: any[] } | undefined;
	return call?.data ?? [];
}
/** The entries from the most recent enqueueEmails call. */
function enqueuedEntries(): any[] {
	return (enqueue.mock.calls.at(-1)?.[0] as any[]) ?? [];
}

beforeEach(() => {
	vi.clearAllMocks();
	// createManyAndReturn echoes the written rows back with synthetic ids (what enqueue then references).
	createManyAndReturn.mockImplementation((async ({ data }: any) =>
		data.map((d: any, i: number) => ({ id: `n${i}`, recipientUserId: d.recipientUserId, contextPageId: d.contextPageId, type: d.type }))) as never);
	enqueue.mockResolvedValue(undefined as never);
});

describe("emitActivity fan-out", () => {
	test("PAGE comment fans out to ADMIN + EDITOR, tagged with contextPageId; MEMBER excluded", async () => {
		pageManagers([
			{ userId: "admin", role: "ADMIN" },
			{ userId: "editor", role: "EDITOR" },
			{ userId: "member", role: "MEMBER" },
		]);

		await emitActivity("comment.created", { type: "USER", id: "commenter" }, { type: "PAGE", id: "pageY" }, { type: "POST", id: "post1" });

		const rows = writtenRows();
		expect(rows.map((r) => r.recipientUserId).sort()).toEqual(["admin", "editor"]);
		expect(rows.every((r) => r.contextPageId === "pageY")).toBe(true);
	});

	test("request types reach ADMINs only — editors get nothing", async () => {
		pageManagers([
			{ userId: "admin", role: "ADMIN" },
			{ userId: "editor", role: "EDITOR" },
		]);
		await emitActivity("membership.requested", { type: "USER", id: "joiner" }, { type: "PAGE", id: "pageY" });
		expect(writtenRows().map((r) => r.recipientUserId)).toEqual(["admin"]);
		expect(writtenRows()[0].type).toBe("JOIN_REQUEST");
	});

	test("a page invite stores the offered role and names no deep-link object", async () => {
		await emitActivity("membership.invited", { type: "PAGE", id: "pageY" }, { type: "USER", id: "sam" }, { role: "EDITOR" });
		expect(writtenRows()).toHaveLength(1);
		expect(writtenRows()[0]).toMatchObject({
			recipientUserId: "sam",
			type: "MEMBER_INVITE",
			actorPageId: "pageY",
			objectType: null,
			objectId: "EDITOR",
		});
	});

	test("USER target yields one personal row (contextPageId null)", async () => {
		await emitActivity("follow.created", { type: "USER", id: "follower" }, { type: "USER", id: "followee" });
		const rows = writtenRows();
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ recipientUserId: "followee", contextPageId: null, type: "NEW_FOLLOWER", actorUserId: "follower" });
	});

	test("self-notification is dropped (USER actor == recipient)", async () => {
		await emitActivity("comment.created", { type: "USER", id: "me" }, { type: "USER", id: "me" }, { type: "POST", id: "p" });
		expect(createManyAndReturn).not.toHaveBeenCalled();
	});

	test("unknown action is log-only — no rows written", async () => {
		await emitActivity("bogus.action", { type: "USER", id: "x" }, { type: "USER", id: "y" });
		expect(createManyAndReturn).not.toHaveBeenCalled();
	});

	test("a dispatch failure never propagates to the caller", async () => {
		createManyAndReturn.mockRejectedValueOnce(new Error("db down"));
		await expect(
			emitActivity("follow.created", { type: "USER", id: "a" }, { type: "USER", id: "b" }),
		).resolves.toBeUndefined();
	});
});

describe("comment.mentioned — only recipients who can see the post", () => {
	const post = (contentVisibility: "LISTED" | "PRIVATE") =>
		vi.mocked(prisma.post.findUnique).mockResolvedValue({
			id: "p1", userId: "owner", pageId: null, asPageId: null, showOnAuthorProfile: true,
			eventId: null, parentPostId: null, status: "PUBLISHED", contentVisibility,
		} as never);
	const object = { type: "POST" as const, id: "p1", commentId: "c1" };

	beforeEach(() => {
		permFindMany.mockResolvedValue([] as never);
		vi.mocked(prisma.follow.findFirst).mockResolvedValue(null as never);
	});

	test("a tag on a listed post notifies the tagged user and anchors the comment", async () => {
		post("LISTED");
		await emitActivity("comment.mentioned", { type: "USER", id: "alice" }, { type: "USER", id: "sam" }, object);
		expect(writtenRows()).toHaveLength(1);
		expect(writtenRows()[0]).toMatchObject({
			recipientUserId: "sam", type: "MENTION", objectType: "POST", objectId: "p1", commentId: "c1",
		});
		expect(enqueuedEntries()[0]).toMatchObject({ recipientUserId: "sam", category: "COMMENTS" });
	});

	test("a tag on a PRIVATE post the tagged user can't see notifies nobody", async () => {
		post("PRIVATE"); // sam doesn't follow the owner → can't see it
		await emitActivity("comment.mentioned", { type: "USER", id: "alice" }, { type: "USER", id: "sam" }, object);
		expect(createManyAndReturn).not.toHaveBeenCalled();
		expect(enqueue).not.toHaveBeenCalled();
	});

	test("a tag on a PRIVATE post reaches a tagged follower of the owner", async () => {
		post("PRIVATE");
		vi.mocked(prisma.follow.findFirst).mockResolvedValue({ id: "f1" } as never);
		await emitActivity("comment.mentioned", { type: "USER", id: "alice" }, { type: "USER", id: "sam" }, object);
		expect(writtenRows().map((r) => r.recipientUserId)).toEqual(["sam"]);
	});

	test("tagging a page fans out to its ADMIN + EDITOR", async () => {
		post("LISTED");
		pageManagers([
			{ userId: "admin", role: "ADMIN" },
			{ userId: "editor", role: "EDITOR" },
			{ userId: "member", role: "MEMBER" },
		]);
		await emitActivity("comment.mentioned", { type: "USER", id: "alice" }, { type: "PAGE", id: "pageY" }, object);
		expect(writtenRows().map((r) => r.recipientUserId).sort()).toEqual(["admin", "editor"]);
		expect(writtenRows().every((r) => r.type === "MENTION" && r.contextPageId === "pageY")).toBe(true);
		// One read of the post serves every recipient's check.
		expect(prisma.post.findUnique).toHaveBeenCalledTimes(1);
	});

	test("the person who wrote it is never notified, even through a page they manage", async () => {
		post("LISTED");
		pageManagers([
			{ userId: "admin", role: "ADMIN" },
			{ userId: "alice", role: "EDITOR" },
		]);
		// alice, commenting as page pageZ, tags pageY — which she also edits
		await emitActivity("comment.mentioned", { type: "PAGE", id: "pageZ" }, { type: "PAGE", id: "pageY" }, object, { authorUserId: "alice" });
		expect(writtenRows().map((r) => r.recipientUserId)).toEqual(["admin"]);
	});

	test("a tag on a DRAFT post reaches no one but its owner", async () => {
		vi.mocked(prisma.post.findUnique).mockResolvedValue({
			id: "p1", userId: "owner", pageId: null, asPageId: null, showOnAuthorProfile: true,
			eventId: null, parentPostId: null, status: "DRAFT", contentVisibility: "LISTED",
		} as never);
		await emitActivity("comment.mentioned", { type: "USER", id: "owner" }, { type: "USER", id: "sam" }, object);
		expect(createManyAndReturn).not.toHaveBeenCalled();
	});

	test("a tag on a PRIVATE event the tagged user can't see notifies nobody", async () => {
		vi.mocked(prisma.event.findUnique).mockResolvedValue({
			id: "e1", userId: "owner", pageId: null, asPageId: null, showOnAuthorProfile: true,
			status: "PUBLISHED", contentVisibility: "PRIVATE",
		} as never);
		await emitActivity("comment.mentioned", { type: "USER", id: "alice" }, { type: "USER", id: "sam" }, { type: "EVENT", id: "e1", commentId: "c1" });
		expect(createManyAndReturn).not.toHaveBeenCalled();
	});
});

describe("emitActivity → email enqueue", () => {
	test("each created notification enqueues a matching email (same recipient, mapped category)", async () => {
		await emitActivity("comment.created", { type: "USER", id: "sam" }, { type: "USER", id: "alice" }, { type: "POST", id: "p1" });
		const entries = enqueuedEntries();
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({ recipientUserId: "alice", contextPageId: null, category: "COMMENTS", sourceType: "NOTIFICATION" });
		expect(entries[0].sourceId).toBeTruthy();
	});

	test("PAGE comment enqueues one email per manager, each in the page context", async () => {
		pageManagers([
			{ userId: "admin", role: "ADMIN" },
			{ userId: "editor", role: "EDITOR" },
		]);
		await emitActivity("comment.created", { type: "USER", id: "sam" }, { type: "PAGE", id: "pageY" }, { type: "POST", id: "p1" });
		const entries = enqueuedEntries();
		expect(entries.map((e) => e.recipientUserId).sort()).toEqual(["admin", "editor"]);
		expect(entries.every((e) => e.contextPageId === "pageY" && e.category === "COMMENTS")).toBe(true);
	});

	test("no email enqueue for a self-notification (nothing created)", async () => {
		await emitActivity("comment.created", { type: "USER", id: "me" }, { type: "USER", id: "me" }, { type: "POST", id: "p" });
		expect(enqueue).not.toHaveBeenCalled();
	});
});
