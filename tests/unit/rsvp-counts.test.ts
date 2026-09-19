import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		rsvp: { groupBy: vi.fn() },
		rsvpGuest: { count: vi.fn() },
	},
}));

import { getRsvpCounts } from "@/lib/utils/server/rsvp";
import { prisma } from "@/lib/utils/server/prisma";

const groupBy = vi.mocked(prisma.rsvp.groupBy);
const guestCount = vi.mocked(prisma.rsvpGuest.count);

beforeEach(() => {
	vi.clearAllMocks();
});

describe("getRsvpCounts", () => {
	test("goingTotal = GOING hosts + plus-ones; MAYBE excluded from capacity", async () => {
		groupBy.mockResolvedValue([
			{ status: "GOING", _count: { status: 3 } },
			{ status: "MAYBE", _count: { status: 2 } },
			{ status: "CANT_MAKE_IT", _count: { status: 1 } },
		] as never);
		guestCount.mockResolvedValue(2);

		const counts = await getRsvpCounts("ev1");

		expect(counts.going).toBe(3);
		expect(counts.maybe).toBe(2);
		expect(counts.cantMakeIt).toBe(1);
		expect(counts.total).toBe(6);
		expect(counts.guests).toBe(2);
		expect(counts.goingTotal).toBe(5);

		expect(guestCount).toHaveBeenCalledWith({
			where: { rsvp: { eventId: "ev1", status: "GOING" } },
		});
	});

	test("returns zeros when no RSVPs exist", async () => {
		groupBy.mockResolvedValue([] as never);
		guestCount.mockResolvedValue(0);

		const counts = await getRsvpCounts("ev-empty");

		expect(counts).toEqual({
			going: 0,
			maybe: 0,
			cantMakeIt: 0,
			total: 0,
			guests: 0,
			goingTotal: 0,
		});
	});
});
