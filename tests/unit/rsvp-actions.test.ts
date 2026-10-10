/**
 * submitRsvpAction — member identity is server-authoritative; activity actor seam.
 *
 * Mocks the real seams (prisma, session, visibility's event gate, user lookup) and lets the
 * action wrapper, submitRsvp, validation, and createOrUpdateRsvp run for real. Rate limiting and
 * activity are stubbed as orthogonal concerns.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		rsvp: { findUnique: vi.fn() },
		$transaction: vi.fn(),
	},
}));
vi.mock("@/lib/utils/server/rate-limit", () => ({ isRateLimited: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/utils/server/visibility", () => ({
	viewerContextFor: vi.fn(async (userId: string) => ({ userId, memberPageIds: [] })),
	requireViewableEvent: vi.fn(),
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/user", () => ({ getUserById: vi.fn(), publicUserEmbedFields: {} }));
vi.mock("@/lib/utils/server/activity", () => ({ emitActivity: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

import { submitRsvpAction } from "@/lib/actions/rsvp";
import { prisma } from "@/lib/utils/server/prisma";
import { isRateLimited } from "@/lib/utils/server/rate-limit";
import { requireViewableEvent } from "@/lib/utils/server/visibility";
import { getSessionContext } from "@/lib/utils/server/session";
import { getUserById } from "@/lib/utils/server/user";
import { emitActivity } from "@/lib/utils/server/activity";

const emit = vi.mocked(emitActivity);
const tx = {
	rsvp: { create: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
	rsvpGuest: { deleteMany: vi.fn(), createMany: vi.fn() },
};

function asViewer(userId: string | null) {
	vi.mocked(getSessionContext).mockResolvedValue(userId ? { userId, activePageId: null } : (null as never));
}

const alex = { id: "member1", email: "alex@x.com", firstName: "Alex", lastName: null, displayName: null, handle: "alex" };

/** The RSVP row already stored for the email (null = none). */
function existingRsvp(row: { userId: string | null } | null) {
	vi.mocked(prisma.rsvp.findUnique).mockResolvedValue(row as never);
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(isRateLimited).mockResolvedValue(false);
	vi.mocked(requireViewableEvent).mockResolvedValue({
		id: "ev1", status: "PUBLISHED", userId: "host", pageId: null, asPageId: null,
	} as never);
	existingRsvp(null);
	vi.mocked(prisma.$transaction).mockImplementation((async (cb: (t: typeof tx) => unknown) => cb(tx)) as never);
	tx.rsvp.create.mockResolvedValue({ id: "r1" });
	tx.rsvp.update.mockResolvedValue({ id: "r1" });
	tx.rsvp.findUniqueOrThrow.mockImplementation(async () => ({
		id: "r1", eventId: "ev1", guests: [], ...tx.rsvp.create.mock.calls.at(-1)?.[0]?.data,
	}));
});

describe("submitRsvpAction", () => {
	test("member RSVP emits USER actor and records server-side identity", async () => {
		asViewer("member1");
		vi.mocked(getUserById).mockResolvedValue(alex as never);

		const res = await submitRsvpAction({ eventId: "ev1", status: "GOING" });

		expect(res).toEqual({ ok: true, data: { status: "GOING" } });
		expect(tx.rsvp.create).toHaveBeenCalledWith({
			data: { eventId: "ev1", name: "Alex", email: "alex@x.com", status: "GOING", userId: "member1" },
		});
		expect(emit).toHaveBeenCalledWith(
			"rsvp.created",
			{ type: "USER", id: "member1" },
			{ type: "USER", id: "host" },
			{ type: "EVENT", id: "ev1" },
		);
	});

	test("member RSVP ignores hostile client name and email", async () => {
		asViewer("member1");
		vi.mocked(getUserById).mockResolvedValue(alex as never);

		await submitRsvpAction({ eventId: "ev1", status: "GOING", name: "Attacker", email: "attacker@x.com" });

		expect(tx.rsvp.create).toHaveBeenCalledWith({
			data: { eventId: "ev1", name: "Alex", email: "alex@x.com", status: "GOING", userId: "member1" },
		});
	});

	test("anonymous RSVP emits ANON actor with no userId", async () => {
		asViewer(null);

		const res = await submitRsvpAction({ eventId: "ev1", status: "GOING", name: "Guest", email: "guest@x.com" });

		expect(res.ok).toBe(true);
		expect(tx.rsvp.create).toHaveBeenCalledWith({
			data: { eventId: "ev1", name: "Guest", email: "guest@x.com", status: "GOING", userId: null },
		});
		expect(emit).toHaveBeenCalledWith(
			"rsvp.created",
			{ type: "ANON", label: "Guest" },
			expect.any(Object),
			expect.any(Object),
		);
	});

	test("anonymous submission cannot tamper with a member-owned RSVP", async () => {
		asViewer(null);
		existingRsvp({ userId: "member1" });

		const res = await submitRsvpAction({ eventId: "ev1", status: "CANT_MAKE_IT", name: "Attacker", email: "alex@x.com" });

		expect(res).toMatchObject({ ok: false, error: "forbidden" });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	test("editing an RSVP does not re-emit activity", async () => {
		asViewer(null);
		existingRsvp({ userId: null });

		const res = await submitRsvpAction({ eventId: "ev1", status: "MAYBE", name: "Guest", email: "guest@x.com" });

		expect(res.ok).toBe(true);
		expect(tx.rsvp.update).toHaveBeenCalled();
		expect(emit).not.toHaveBeenCalled();
	});

	test("an event the viewer cannot see is not_found", async () => {
		asViewer(null);
		vi.mocked(requireViewableEvent).mockResolvedValue(null);

		const res = await submitRsvpAction({ eventId: "ev1", status: "GOING", name: "Guest", email: "guest@x.com" });

		expect(res).toMatchObject({ ok: false, error: "not_found" });
	});

	test("an unpublished event refuses RSVPs", async () => {
		asViewer(null);
		vi.mocked(requireViewableEvent).mockResolvedValue({ id: "ev1", status: "DRAFT", userId: "host" } as never);

		const res = await submitRsvpAction({ eventId: "ev1", status: "GOING", name: "Guest", email: "guest@x.com" });

		expect(res).toMatchObject({ ok: false, error: "invalid" });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	test("invalid anonymous input is refused with the validation message", async () => {
		asViewer(null);

		const res = await submitRsvpAction({ eventId: "ev1", status: "GOING", name: "Guest", email: "not-an-email" });

		expect(res).toMatchObject({ ok: false, error: "invalid", message: "Invalid email address" });
	});

	test("is rate limited", async () => {
		asViewer(null);
		vi.mocked(isRateLimited).mockResolvedValue(true);

		const res = await submitRsvpAction({ eventId: "ev1", status: "GOING", name: "Guest", email: "guest@x.com" });

		expect(res).toMatchObject({ ok: false, error: "rate_limited" });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});
});
