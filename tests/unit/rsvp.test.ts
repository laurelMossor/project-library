import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => {
	const tx = {
		rsvp: {
			create: vi.fn(),
			update: vi.fn(),
			findUniqueOrThrow: vi.fn(),
		},
		rsvpGuest: {
			deleteMany: vi.fn(),
			createMany: vi.fn(),
		},
	};
	return {
		prisma: {
			rsvp: { findUnique: vi.fn() },
			$transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
			__tx: tx,
		},
	};
});

import { createOrUpdateRsvp } from "@/lib/utils/server/rsvp";
import { validateRsvpGuests } from "@/lib/validations";
import { prisma } from "@/lib/utils/server/prisma";

const rsvp = vi.mocked(prisma.rsvp);
const tx = (prisma as typeof prisma & { __tx: {
	rsvp: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; findUniqueOrThrow: ReturnType<typeof vi.fn> };
	rsvpGuest: { deleteMany: ReturnType<typeof vi.fn>; createMany: ReturnType<typeof vi.fn> };
} }).__tx;

beforeEach(() => {
	vi.clearAllMocks();
});

describe("validateRsvpGuests", () => {
	test("allows zero or one plus-one", () => {
		expect(validateRsvpGuests(undefined).valid).toBe(true);
		expect(validateRsvpGuests([]).valid).toBe(true);
		expect(validateRsvpGuests([{}]).valid).toBe(true);
		expect(validateRsvpGuests([{ name: "Pat" }]).valid).toBe(true);
	});

	test("rejects more than one plus-one", () => {
		const result = validateRsvpGuests([{ name: "A" }, { name: "B" }]);
		expect(result.valid).toBe(false);
		expect(result.error).toMatch(/one plus-one/i);
	});
});

describe("createOrUpdateRsvp guests + userId", () => {
	test("persists a single plus-one on create without flipping created", async () => {
		rsvp.findUnique.mockResolvedValue(null as never);
		tx.rsvp.create.mockResolvedValue({ id: "r1" } as never);
		tx.rsvp.findUniqueOrThrow.mockResolvedValue({
			id: "r1",
			userId: null,
			guests: [{ id: "g1", name: "Pat" }],
			user: null,
		} as never);

		const { created, rsvp: row } = await createOrUpdateRsvp(
			"ev1",
			{ name: "Alex", email: "alex@x.com", status: "GOING", guests: [{ name: "Pat" }] },
		);

		expect(created).toBe(true);
		expect(tx.rsvpGuest.deleteMany).toHaveBeenCalledWith({ where: { rsvpId: "r1" } });
		expect(tx.rsvpGuest.createMany).toHaveBeenCalledWith({
			data: [{ rsvpId: "r1", name: "Pat" }],
		});
		expect(row.guests).toHaveLength(1);
	});

	test("replaces plus-one on edit without re-creating the RSVP", async () => {
		rsvp.findUnique.mockResolvedValue({ id: "r1", userId: "u1" } as never);
		tx.rsvp.update.mockResolvedValue({ id: "r1" } as never);
		tx.rsvp.findUniqueOrThrow.mockResolvedValue({
			id: "r1",
			userId: "u1",
			guests: [{ id: "g2", name: "Sam" }],
			user: null,
		} as never);

		const { created } = await createOrUpdateRsvp(
			"ev1",
			{ name: "Alex", email: "alex@x.com", status: "GOING", guests: [{ name: "Sam" }] },
			{ userId: "u1" },
		);

		expect(created).toBe(false);
		expect(tx.rsvp.update).toHaveBeenCalledWith(
			expect.objectContaining({ data: expect.objectContaining({ userId: "u1" }) }),
		);
		expect(tx.rsvpGuest.createMany).toHaveBeenCalledWith({
			data: [{ rsvpId: "r1", name: "Sam" }],
		});
	});

	test("records userId on authenticated create path", async () => {
		rsvp.findUnique.mockResolvedValue(null as never);
		tx.rsvp.create.mockResolvedValue({ id: "r2" } as never);
		tx.rsvp.findUniqueOrThrow.mockResolvedValue({
			id: "r2",
			userId: "member1",
			guests: [],
			user: { id: "member1", handle: "alex", displayName: "Alex", avatarImageId: null },
		} as never);

		const { rsvp: row } = await createOrUpdateRsvp(
			"ev1",
			{ name: "Alex", email: "alex@x.com", status: "GOING" },
			{ userId: "member1" },
		);

		expect(tx.rsvp.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ userId: "member1" }),
			}),
		);
		expect(row.userId).toBe("member1");
	});

	test("anonymous path keeps userId null", async () => {
		rsvp.findUnique.mockResolvedValue(null as never);
		tx.rsvp.create.mockResolvedValue({ id: "r3" } as never);
		tx.rsvp.findUniqueOrThrow.mockResolvedValue({
			id: "r3",
			userId: null,
			guests: [],
			user: null,
		} as never);

		await createOrUpdateRsvp("ev1", { name: "Guest", email: "guest@x.com", status: "MAYBE" });

		expect(tx.rsvp.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ userId: null }),
			}),
		);
		expect(tx.rsvpGuest.createMany).not.toHaveBeenCalled();
	});

	test("drops plus-one when status is not GOING", async () => {
		rsvp.findUnique.mockResolvedValue({ id: "r4", userId: null } as never);
		tx.rsvp.update.mockResolvedValue({ id: "r4" } as never);
		tx.rsvp.findUniqueOrThrow.mockResolvedValue({
			id: "r4",
			userId: null,
			guests: [],
			user: null,
		} as never);

		await createOrUpdateRsvp(
			"ev1",
			{ name: "Alex", email: "alex@x.com", status: "MAYBE", guests: [{ name: "Pat" }] },
		);

		expect(tx.rsvpGuest.deleteMany).toHaveBeenCalledWith({ where: { rsvpId: "r4" } });
		expect(tx.rsvpGuest.createMany).not.toHaveBeenCalled();
	});

	test("preserves unnamed plus-one on edit", async () => {
		rsvp.findUnique.mockResolvedValue({ id: "r5", userId: null } as never);
		tx.rsvp.update.mockResolvedValue({ id: "r5" } as never);
		tx.rsvp.findUniqueOrThrow.mockResolvedValue({
			id: "r5",
			userId: null,
			guests: [{ id: "g1", name: null }],
			user: null,
		} as never);

		await createOrUpdateRsvp(
			"ev1",
			{ name: "Alex", email: "alex@x.com", status: "GOING", guests: [{ name: undefined }] },
		);

		expect(tx.rsvpGuest.createMany).toHaveBeenCalledWith({
			data: [{ rsvpId: "r5", name: null }],
		});
	});
});
