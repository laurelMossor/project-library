/**
 * Connections reads decide admin-only slices themselves. Prisma is mocked only for the
 * permission lookup; the list loaders are mocked so a test can see whether they ran.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		permission: { findFirst: vi.fn(), findMany: vi.fn() },
		page: { findUnique: vi.fn() },
	},
}));

vi.mock("@/lib/utils/server/follow", () => ({
	getUserFollowers: vi.fn(async () => []),
	getUserFollowing: vi.fn(async () => []),
	getPageFollowers: vi.fn(async () => []),
	getPageFollowing: vi.fn(async () => []),
}));

vi.mock("@/lib/utils/server/requests", () => ({
	listIncomingFollowRequests: vi.fn(async () => []),
	listMyInvites: vi.fn(async () => []),
	listPageEmailInvites: vi.fn(async () => []),
	listPageInvites: vi.fn(async () => []),
	listPageRequests: vi.fn(async () => []),
}));

import { getConnectionsData } from "@/lib/utils/server/connections";
import { prisma } from "@/lib/utils/server/prisma";
import { getUserFollowers, getUserFollowing } from "@/lib/utils/server/follow";
import {
	listIncomingFollowRequests,
	listMyInvites,
	listPageEmailInvites,
	listPageInvites,
	listPageRequests,
} from "@/lib/utils/server/requests";

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(prisma.permission.findMany).mockResolvedValue([] as never);
	vi.mocked(prisma.page.findUnique).mockResolvedValue({ membershipPolicy: "INVITE_ONLY" } as never);
});

describe("getConnectionsData", () => {
	test("a user id that isn't the actor → forbidden, no lists loaded", async () => {
		await expect(getConnectionsData("me", { type: "USER", id: "other" })).rejects.toMatchObject({
			code: "forbidden",
		});
		expect(listMyInvites).not.toHaveBeenCalled();
		expect(listIncomingFollowRequests).not.toHaveBeenCalled();
		expect(getUserFollowers).not.toHaveBeenCalled();
		expect(getUserFollowing).not.toHaveBeenCalled();
	});

	test("a page editor does not load invites, requests, or email addresses", async () => {
		vi.mocked(prisma.permission.findFirst).mockResolvedValue(null);
		await getConnectionsData("editor", { type: "PAGE", id: "p1" });
		expect(listPageEmailInvites).not.toHaveBeenCalled();
		expect(listPageInvites).not.toHaveBeenCalled();
		expect(listPageRequests).not.toHaveBeenCalled();
	});

	test("a page admin loads invites, requests, and email addresses", async () => {
		vi.mocked(prisma.permission.findFirst).mockResolvedValue({ role: "ADMIN" } as never);
		await getConnectionsData("admin", { type: "PAGE", id: "p1" });
		expect(listPageEmailInvites).toHaveBeenCalledWith("p1");
		expect(listPageInvites).toHaveBeenCalledWith("p1");
		expect(listPageRequests).toHaveBeenCalledWith("p1");
	});
});
