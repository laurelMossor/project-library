import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: { image: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/utils/server/storage", () => ({ removeStoragePaths: vi.fn() }));

import { avatarAssignmentError } from "@/lib/utils/server/image-attachment";
import { prisma } from "@/lib/utils/server/prisma";

beforeEach(() => vi.clearAllMocks());

describe("avatarAssignmentError", () => {
	test("rejects another person's image and an image already on content", async () => {
		vi.mocked(prisma.image.findUnique).mockResolvedValueOnce({
			uploadedByUserId: "someone-else",
			_count: { attachments: 0 },
		} as never);
		await expect(avatarAssignmentError("me", "img-1", null)).resolves.toMatch(/profile picture/i);

		vi.mocked(prisma.image.findUnique).mockResolvedValueOnce({
			uploadedByUserId: "me",
			_count: { attachments: 2 },
		} as never);
		await expect(avatarAssignmentError("me", "img-2", null)).resolves.toMatch(/profile picture/i);
	});

	test("rejects a missing image", async () => {
		vi.mocked(prisma.image.findUnique).mockResolvedValueOnce(null);
		await expect(avatarAssignmentError("me", "gone", null)).resolves.toMatch(/profile picture/i);
	});

	test("allows the caller's unattached image and the profile's current avatar", async () => {
		vi.mocked(prisma.image.findUnique).mockResolvedValueOnce({
			uploadedByUserId: "me",
			_count: { attachments: 0 },
		} as never);
		await expect(avatarAssignmentError("me", "img-ok", null)).resolves.toBeNull();

		await expect(avatarAssignmentError("me", "img-current", "img-current")).resolves.toBeNull();
		expect(prisma.image.findUnique).toHaveBeenCalledTimes(1);
	});
});
