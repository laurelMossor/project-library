/**
 * Unit tests for the email flush (email-flush.ts). Mocks the collaborators (prisma, the preference
 * resolver, the notification hydrator, the sender) and exercises the flush's orchestration:
 * read-suppression, preference suppression, coalescing into one email, and the empty case.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ decider: (_item: unknown) => true as boolean }));

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		emailOutbox: { updateMany: vi.fn(), findMany: vi.fn() },
		notification: { findMany: vi.fn() },
		message: { findMany: vi.fn() },
		user: { findMany: vi.fn() },
		page: { findMany: vi.fn() },
		permission: { findMany: vi.fn() },
	},
}));
vi.mock("@/lib/utils/server/notification-preferences", () => {
	const prefDecisionKey = (id: any, cat: any) =>
		`${id.contextPageId ? "p:" + id.contextPageId : "u:" + id.recipientUserId}|${cat}`;
	return {
		prefDecisionKey,
		resolveEmailPrefs: async (items: any[]) => {
			const m = new Map<string, boolean>();
			for (const it of items) m.set(prefDecisionKey(it, it.category), h.decider(it));
			return m;
		},
	};
});
vi.mock("@/lib/utils/server/notification", () => ({
	// Return one hydrated item per input row, carrying a `text` the mocked copy fn will echo.
	hydrateNotificationRows: async (rows: any[]) => rows.map((r) => ({ href: `/p/${r.id}`, text: `notif ${r.id}` })),
}));
vi.mock("@/lib/components/notifications/notification-copy", () => ({ notificationMessage: (i: any) => i.text }));
vi.mock("@/lib/utils/server/email/emails", () => ({ sendNotificationEmail: vi.fn() }));
vi.mock("@/lib/utils/server/unsubscribe-token", () => ({ signUnsubscribeToken: () => "tok" }));
vi.mock("@/lib/utils/server/url", () => ({ absoluteUrl: (p: string) => `https://t${p}` }));
vi.mock("@/lib/utils/server/log", () => ({ logAction: vi.fn() }));

import { flushEmailOutbox } from "@/lib/utils/server/email-flush";
import { prisma } from "@/lib/utils/server/prisma";
import { sendNotificationEmail } from "@/lib/utils/server/email/emails";

const outboxFindMany = vi.mocked(prisma.emailOutbox.findMany);
const outboxUpdateMany = vi.mocked(prisma.emailOutbox.updateMany);
const notifFindMany = vi.mocked(prisma.notification.findMany);
const send = vi.mocked(sendNotificationEmail);

function outboxRow(over: Partial<any> = {}): any {
	return { id: "o1", recipientUserId: "alice", contextPageId: null, category: "COMMENTS", sourceType: "NOTIFICATION", sourceId: "n1", claimedAt: null, sentAt: null, ...over };
}
function alice() {
	return { id: "alice", email: "alice@test.dev", handle: "alice", firstName: "Al", lastName: "Ice", displayName: null, avatarImageId: null, avatarImage: null };
}
/** The outcomes passed to every emailOutbox.updateMany stamp call. */
function stampedOutcomes(): string[] {
	return outboxUpdateMany.mock.calls.map((c) => (c[0] as any)?.data?.outcome).filter(Boolean);
}

beforeEach(() => {
	vi.clearAllMocks();
	h.decider = () => true;
	outboxUpdateMany.mockResolvedValue({ count: 0 } as never);
	outboxFindMany.mockResolvedValue([] as never);
	notifFindMany.mockResolvedValue([] as never);
	vi.mocked(prisma.message.findMany).mockResolvedValue([] as never);
	vi.mocked(prisma.user.findMany).mockResolvedValue([alice()] as never);
	vi.mocked(prisma.page.findMany).mockResolvedValue([] as never);
	vi.mocked(prisma.permission.findMany).mockResolvedValue([] as never);
	send.mockResolvedValue({ ok: true } as never);
});

describe("flushEmailOutbox", () => {
	test("empty queue → no send, zeroed result", async () => {
		outboxFindMany.mockResolvedValue([] as never);
		const res = await flushEmailOutbox();
		expect(res).toEqual({ claimed: 0, sent: 0, suppressed: 0, recipients: 0 });
		expect(send).not.toHaveBeenCalled();
	});

	test("read source is suppressed, not emailed", async () => {
		outboxFindMany.mockResolvedValue([outboxRow()] as never);
		notifFindMany.mockResolvedValue([{ id: "n1", readAt: new Date(), type: "COMMENT" }] as never);
		const res = await flushEmailOutbox();
		expect(send).not.toHaveBeenCalled();
		expect(res.suppressed).toBe(1);
		expect(stampedOutcomes()).toContain("SUPPRESSED_READ");
	});

	test("preference-off source is suppressed, not emailed", async () => {
		outboxFindMany.mockResolvedValue([outboxRow()] as never);
		notifFindMany.mockResolvedValue([{ id: "n1", readAt: null, type: "COMMENT" }] as never);
		h.decider = () => false;
		const res = await flushEmailOutbox();
		expect(send).not.toHaveBeenCalled();
		expect(res.suppressed).toBe(1);
		expect(stampedOutcomes()).toContain("SUPPRESSED_PREF");
	});

	test("coalescing: two unread notifications for one recipient → ONE email with two rows", async () => {
		outboxFindMany.mockResolvedValue([
			outboxRow({ id: "o1", sourceId: "n1" }),
			outboxRow({ id: "o2", sourceId: "n2" }),
		] as never);
		notifFindMany.mockResolvedValue([
			{ id: "n1", readAt: null, type: "COMMENT" },
			{ id: "n2", readAt: null, type: "COMMENT" },
		] as never);
		const res = await flushEmailOutbox();
		expect(send).toHaveBeenCalledTimes(1);
		const props = send.mock.calls[0][1] as any;
		expect(props.sections).toHaveLength(1);
		expect(props.sections[0].rows).toHaveLength(2);
		expect(res.sent).toBe(1);
		expect(stampedOutcomes()).toContain("SENT");
	});

	test("a provider failure releases the claim (retry next window), not stamped SENT", async () => {
		outboxFindMany.mockResolvedValue([outboxRow()] as never);
		notifFindMany.mockResolvedValue([{ id: "n1", readAt: null, type: "COMMENT" }] as never);
		send.mockResolvedValue({ ok: false, error: "bounced" } as never);
		const res = await flushEmailOutbox();
		expect(res.sent).toBe(0);
		expect(stampedOutcomes()).not.toContain("SENT");
		// claim released: an updateMany set claimedAt back to null
		expect(outboxUpdateMany.mock.calls.some((c) => (c[0] as any)?.data?.claimedAt === null)).toBe(true);
	});
});
