/**
 * POST /api/events/:id/rsvps — member identity is server-authoritative; activity actor seam.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/utils/server/permission", () => ({ canActAsEntity: vi.fn() }));
vi.mock("@/lib/utils/server/rate-limit", () => ({ enforceRateLimit: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/utils/server/visibility", () => ({
	getViewerContext: vi.fn().mockResolvedValue({ userId: "viewer" }),
	requireViewableEvent: vi.fn().mockResolvedValue({
		id: "ev1",
		status: "PUBLISHED",
		userId: "host",
		pageId: null,
	}),
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/user", () => ({ getUserById: vi.fn() }));
vi.mock("@/lib/utils/server/rsvp", () => ({ createOrUpdateRsvp: vi.fn(), getRsvpByEmail: vi.fn() }));
vi.mock("@/lib/utils/server/activity", () => ({ emitActivity: vi.fn() }));

import { POST } from "@/app/api/events/[id]/rsvps/route";
import { getSessionContext } from "@/lib/utils/server/session";
import { getUserById } from "@/lib/utils/server/user";
import { createOrUpdateRsvp, getRsvpByEmail } from "@/lib/utils/server/rsvp";
import { emitActivity } from "@/lib/utils/server/activity";

const createRsvp = vi.mocked(createOrUpdateRsvp);
const getExistingRsvp = vi.mocked(getRsvpByEmail);
const emit = vi.mocked(emitActivity);

beforeEach(() => {
	vi.clearAllMocks();
	getExistingRsvp.mockResolvedValue(null);
});

describe("POST /api/events/:id/rsvps", () => {
	test("authenticated RSVP emits USER actor and records server-side identity", async () => {
		vi.mocked(getSessionContext).mockResolvedValue({ userId: "member1", activePageId: null } as never);
		vi.mocked(getUserById).mockResolvedValue({
			id: "member1",
			email: "alex@x.com",
			firstName: "Alex",
			lastName: null,
			displayName: null,
			handle: "alex",
		} as never);
		createRsvp.mockResolvedValue({
			created: true,
			rsvp: {
				id: "r1",
				eventId: "ev1",
				userId: "member1",
				name: "Alex",
				email: "alex@x.com",
				status: "GOING",
				guests: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		});

		const req = new Request("http://x/api/events/ev1/rsvps", {
			method: "POST",
			body: JSON.stringify({ status: "GOING" }),
		});
		const res = await POST(req, { params: Promise.resolve({ id: "ev1" }) });

		expect(res.status).toBe(201);
		expect(createRsvp).toHaveBeenCalledWith(
			"ev1",
			{ name: "Alex", email: "alex@x.com", status: "GOING", guests: undefined },
			{ userId: "member1" },
		);
		expect(emit).toHaveBeenCalledWith(
			"rsvp.created",
			{ type: "USER", id: "member1" },
			{ type: "USER", id: "host" },
			{ type: "EVENT", id: "ev1" },
		);
	});

	test("authenticated RSVP ignores hostile client name and email", async () => {
		vi.mocked(getSessionContext).mockResolvedValue({ userId: "member1", activePageId: null } as never);
		vi.mocked(getUserById).mockResolvedValue({
			id: "member1",
			email: "alex@x.com",
			firstName: "Alex",
			lastName: null,
			displayName: null,
			handle: "alex",
		} as never);
		createRsvp.mockResolvedValue({
			created: true,
			rsvp: {
				id: "r1",
				eventId: "ev1",
				userId: "member1",
				name: "Alex",
				email: "alex@x.com",
				status: "GOING",
				guests: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		});

		const req = new Request("http://x/api/events/ev1/rsvps", {
			method: "POST",
			body: JSON.stringify({
				name: "Attacker",
				email: "attacker@x.com",
				status: "GOING",
			}),
		});
		await POST(req, { params: Promise.resolve({ id: "ev1" }) });

		expect(createRsvp).toHaveBeenCalledWith(
			"ev1",
			{ name: "Alex", email: "alex@x.com", status: "GOING", guests: undefined },
			{ userId: "member1" },
		);
	});

	test("anonymous RSVP emits ANON actor", async () => {
		vi.mocked(getSessionContext).mockResolvedValue(null as never);
		createRsvp.mockResolvedValue({
			created: true,
			rsvp: {
				id: "r2",
				eventId: "ev1",
				userId: null,
				name: "Guest",
				email: "guest@x.com",
				status: "GOING",
				guests: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		});

		const req = new Request("http://x/api/events/ev1/rsvps", {
			method: "POST",
			body: JSON.stringify({ name: "Guest", email: "guest@x.com", status: "GOING" }),
		});
		await POST(req, { params: Promise.resolve({ id: "ev1" }) });

		expect(createRsvp).toHaveBeenCalledWith(
			"ev1",
			{ name: "Guest", email: "guest@x.com", status: "GOING" },
			{ userId: null },
		);
		expect(emit).toHaveBeenCalledWith(
			"rsvp.created",
			{ type: "ANON", label: "Guest" },
			expect.any(Object),
			expect.any(Object),
		);
	});

	test("anonymous POST cannot tamper with a member-owned RSVP", async () => {
		vi.mocked(getSessionContext).mockResolvedValue(null as never);
		getExistingRsvp.mockResolvedValue({
			id: "r1",
			eventId: "ev1",
			userId: "member1",
			name: "Alex",
			email: "alex@x.com",
			status: "GOING",
			guests: [],
			createdAt: new Date(),
			updatedAt: new Date(),
		} as never);

		const req = new Request("http://x/api/events/ev1/rsvps", {
			method: "POST",
			body: JSON.stringify({
				name: "Attacker",
				email: "alex@x.com",
				status: "CANT_MAKE_IT",
			}),
		});
		const res = await POST(req, { params: Promise.resolve({ id: "ev1" }) });

		expect(res.status).toBe(403);
		expect(createRsvp).not.toHaveBeenCalled();
	});

	test("editing an RSVP does not re-emit activity", async () => {
		vi.mocked(getSessionContext).mockResolvedValue(null as never);
		createRsvp.mockResolvedValue({
			created: false,
			rsvp: {
				id: "r2",
				eventId: "ev1",
				userId: null,
				name: "Guest",
				email: "guest@x.com",
				status: "MAYBE",
				guests: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		});

		const req = new Request("http://x/api/events/ev1/rsvps", {
			method: "POST",
			body: JSON.stringify({ name: "Guest", email: "guest@x.com", status: "MAYBE" }),
		});
		await POST(req, { params: Promise.resolve({ id: "ev1" }) });

		expect(emit).not.toHaveBeenCalled();
	});
});
