/**
 * Unit tests for the activity-notification dispatcher (activity.ts). Mocks ONLY prisma and lets the
 * real fan-out logic run: action → type mapping, per-type role targeting (ADMIN-only for request
 * types), contextPageId tagging, self-drop, and failure isolation. Inspects the rows handed to
 * `prisma.notification.createMany`.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		permission: { findMany: vi.fn() },
		notification: { createMany: vi.fn() },
	},
}));

import { emitActivity } from "@/lib/utils/server/activity";
import { prisma } from "@/lib/utils/server/prisma";

const createMany = vi.mocked(prisma.notification.createMany);
const permFindMany = vi.mocked(prisma.permission.findMany);

/** getResourcePermissions reads prisma.permission.findMany — return the page's managers. */
function pageManagers(managers: { userId: string; role: "ADMIN" | "EDITOR" | "MEMBER" }[]) {
	permFindMany.mockResolvedValue(managers as never);
}

/** The `data` rows from the most recent createMany call. */
function writtenRows(): any[] {
	const call = createMany.mock.calls.at(-1)?.[0] as { data: any[] } | undefined;
	return call?.data ?? [];
}

beforeEach(() => {
	vi.clearAllMocks();
	createMany.mockResolvedValue({ count: 0 } as never);
});

describe("emitActivity fan-out", () => {
	test("PAGE comment fans out to ADMIN + EDITOR, tagged with contextPageId; MEMBER excluded", async () => {
		pageManagers([
			{ userId: "admin", role: "ADMIN" },
			{ userId: "editor", role: "EDITOR" },
			{ userId: "member", role: "MEMBER" },
		]);

		await emitActivity(
			"comment.created",
			{ type: "USER", id: "commenter" },
			{ type: "PAGE", id: "pageY" },
			{ type: "POST", id: "post1" },
		);

		const rows = writtenRows();
		expect(rows.map((r) => r.recipientUserId).sort()).toEqual(["admin", "editor"]);
		expect(rows.every((r) => r.contextPageId === "pageY")).toBe(true);
		expect(rows.every((r) => r.type === "COMMENT" && r.actorUserId === "commenter")).toBe(true);
		expect(rows.every((r) => r.objectType === "POST" && r.objectId === "post1")).toBe(true);
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

	test("USER target yields one personal row (contextPageId null)", async () => {
		await emitActivity("follow.created", { type: "USER", id: "follower" }, { type: "USER", id: "followee" });

		const rows = writtenRows();
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ recipientUserId: "followee", contextPageId: null, type: "NEW_FOLLOWER", actorUserId: "follower" });
	});

	test("anonymous actor (guest RSVP) writes actorName, not an actor id", async () => {
		await emitActivity(
			"rsvp.created",
			{ type: "ANON", label: "Guest Jordan" },
			{ type: "USER", id: "host" },
			{ type: "EVENT", id: "ev1" },
		);
		const row = writtenRows()[0];
		expect(row).toMatchObject({ recipientUserId: "host", type: "RSVP", actorName: "Guest Jordan", objectType: "EVENT", objectId: "ev1" });
		expect(row.actorUserId ?? null).toBeNull();
		expect(row.actorPageId ?? null).toBeNull();
	});

	test("self-notification is dropped (USER actor == recipient)", async () => {
		await emitActivity("comment.created", { type: "USER", id: "me" }, { type: "USER", id: "me" }, { type: "POST", id: "p" });
		expect(createMany).not.toHaveBeenCalled();
	});

	test("unknown action is log-only — no rows written", async () => {
		await emitActivity("bogus.action", { type: "USER", id: "x" }, { type: "USER", id: "y" });
		expect(createMany).not.toHaveBeenCalled();
	});

	test("a dispatch failure never propagates to the caller", async () => {
		createMany.mockRejectedValueOnce(new Error("db down"));
		await expect(
			emitActivity("follow.created", { type: "USER", id: "a" }, { type: "USER", id: "b" }),
		).resolves.toBeUndefined();
	});

	test("request.approved links to the requester as recipient", async () => {
		// actor = approver (the target that was requested), recipient = the requester
		await emitActivity("request.approved", { type: "USER", id: "bob" }, { type: "USER", id: "alice" });
		expect(writtenRows()[0]).toMatchObject({ recipientUserId: "alice", type: "REQUEST_APPROVED", actorUserId: "bob" });
	});
});
