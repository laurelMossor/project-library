/**
 * Poster Catcher query-layer tests (Prisma + attachImage mocked):
 *   - applySubmissionEdits: terminal no-touch + READY/NEEDS_FIX recompute from the date gate
 *   - materializeSubmission: server-side poster attach + idempotent PUBLISHED bookkeeping
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { AttachmentTarget } from "@prisma/client";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		eventSubmission: { findUnique: vi.fn(), update: vi.fn() },
		event: { findUnique: vi.fn() },
		imageAttachment: { findFirst: vi.fn() },
	},
}));
vi.mock("@/lib/utils/server/image-attachment", () => ({
	attachImage: vi.fn(),
}));

import { applySubmissionEdits, materializeSubmission } from "@/lib/utils/server/event-submission";
import { prisma } from "@/lib/utils/server/prisma";
import { attachImage } from "@/lib/utils/server/image-attachment";

const anySubmission = { id: "s1", status: "READY", rawImage: null };

beforeEach(() => vi.clearAllMocks());

describe("applySubmissionEdits", () => {
	test("never touches a terminal (PUBLISHED) row", async () => {
		vi.mocked(prisma.eventSubmission.findUnique)
			.mockResolvedValueOnce({ status: "PUBLISHED" } as never)
			.mockResolvedValueOnce(anySubmission as never);

		await applySubmissionEdits("s1", { title: "hijack" });
		expect(vi.mocked(prisma.eventSubmission.update)).not.toHaveBeenCalled();
	});

	test("a future date recomputes status to READY and clears the error note", async () => {
		vi.mocked(prisma.eventSubmission.findUnique)
			.mockResolvedValueOnce({ status: "NEEDS_FIX" } as never)
			.mockResolvedValueOnce(anySubmission as never);

		const future = new Date(Date.now() + 86_400_000).toISOString();
		await applySubmissionEdits("s1", { eventDate: future });

		expect(vi.mocked(prisma.eventSubmission.update)).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: "s1" },
				data: expect.objectContaining({ status: "READY", errorNote: null, eventDate: expect.any(Date) }),
			}),
		);
	});

	test("a past date recomputes to NEEDS_FIX, nulls the date, and sets a reason", async () => {
		vi.mocked(prisma.eventSubmission.findUnique)
			.mockResolvedValueOnce({ status: "PENDING" } as never)
			.mockResolvedValueOnce(anySubmission as never);

		const past = new Date(Date.now() - 86_400_000).toISOString();
		await applySubmissionEdits("s1", { eventDate: past });

		const data = vi.mocked(prisma.eventSubmission.update).mock.calls[0][0].data as Record<string, unknown>;
		expect(data.status).toBe("NEEDS_FIX");
		expect(data.eventDate).toBeNull();
		expect(String(data.errorNote)).toMatch(/future date/i);
	});

	test("editing non-date fields leaves status untouched", async () => {
		vi.mocked(prisma.eventSubmission.findUnique)
			.mockResolvedValueOnce({ status: "READY" } as never)
			.mockResolvedValueOnce(anySubmission as never);

		await applySubmissionEdits("s1", { title: "New title" });

		const data = vi.mocked(prisma.eventSubmission.update).mock.calls[0][0].data as Record<string, unknown>;
		expect(data.title).toBe("New title");
		expect(data).not.toHaveProperty("status");
		expect(data).not.toHaveProperty("eventDate");
	});
});

describe("materializeSubmission", () => {
	test("is a no-op when the submission is already PUBLISHED", async () => {
		vi.mocked(prisma.eventSubmission.findUnique)
			.mockResolvedValueOnce({ status: "PUBLISHED", rawImageId: "img1" } as never)
			.mockResolvedValueOnce(anySubmission as never);

		await materializeSubmission("s1", "e1");

		expect(vi.mocked(prisma.event.findUnique)).not.toHaveBeenCalled();
		expect(vi.mocked(attachImage)).not.toHaveBeenCalled();
		expect(vi.mocked(prisma.eventSubmission.update)).not.toHaveBeenCalled();
	});

	test("attaches the poster server-side and marks PUBLISHED", async () => {
		vi.mocked(prisma.eventSubmission.findUnique)
			.mockResolvedValueOnce({ status: "READY", rawImageId: "img1" } as never)
			.mockResolvedValueOnce({ ...anySubmission, status: "PUBLISHED" } as never);
		vi.mocked(prisma.event.findUnique).mockResolvedValue({ id: "e1" } as never);
		vi.mocked(prisma.imageAttachment.findFirst).mockResolvedValue(null);

		await materializeSubmission("s1", "e1");

		expect(vi.mocked(attachImage)).toHaveBeenCalledWith("img1", AttachmentTarget.EVENT, "e1");
		expect(vi.mocked(prisma.eventSubmission.update)).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: "s1" },
				data: expect.objectContaining({ status: "PUBLISHED", publishedEventId: "e1" }),
			}),
		);
	});

	test("does not double-attach when the poster is already attached (idempotent)", async () => {
		vi.mocked(prisma.eventSubmission.findUnique)
			.mockResolvedValueOnce({ status: "READY", rawImageId: "img1" } as never)
			.mockResolvedValueOnce({ ...anySubmission, status: "PUBLISHED" } as never);
		vi.mocked(prisma.event.findUnique).mockResolvedValue({ id: "e1" } as never);
		vi.mocked(prisma.imageAttachment.findFirst).mockResolvedValue({ id: "att1" } as never);

		await materializeSubmission("s1", "e1");

		expect(vi.mocked(attachImage)).not.toHaveBeenCalled();
		expect(vi.mocked(prisma.eventSubmission.update)).toHaveBeenCalledOnce();
	});

	test("throws if the target event does not exist", async () => {
		vi.mocked(prisma.eventSubmission.findUnique).mockResolvedValueOnce({ status: "READY", rawImageId: null } as never);
		vi.mocked(prisma.event.findUnique).mockResolvedValue(null as never);

		await expect(materializeSubmission("s1", "missing")).rejects.toThrow(/not found/i);
		expect(vi.mocked(prisma.eventSubmission.update)).not.toHaveBeenCalled();
	});
});
