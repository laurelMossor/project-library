/**
 * Page membership, invites, requests, and follower management as Server Actions — the
 * security boundary the old /members, /membership, /email-invites, /requests and
 * /follows DELETE route tests covered.
 *
 * Design (as comment-actions.test.ts): mock only the real seams — `prisma`, the session,
 * Next's request plumbing, activity, and the mailer — and let the genuine gate run:
 * authedAction → guarded util → assertCanManagePage / wouldRemoveLastAdmin / assignableRoles.
 * A broken gate fails a test instead of echoing a mocked verdict.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { PermissionRole } from "@prisma/client";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		page: { findUnique: vi.fn() },
		user: { findUnique: vi.fn(), findMany: vi.fn() },
		permission: {
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			count: vi.fn(),
			upsert: vi.fn(),
			deleteMany: vi.fn(),
		},
		follow: { deleteMany: vi.fn() },
		accessRequest: {
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
		},
		pageEmailInvite: {
			count: vi.fn(),
			updateMany: vi.fn(),
			createManyAndReturn: vi.fn(),
			findFirst: vi.fn(),
			update: vi.fn(),
		},
		$transaction: vi.fn(),
		$executeRaw: vi.fn(),
	},
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/rate-limit", () => ({ isRateLimited: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/utils/server/activity", () => ({ emitActivity: vi.fn() }));
vi.mock("@/lib/utils/server/log", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/utils/server/signup-invite", () => ({
	SIGNUP_INVITE_TTL_DAYS: 14,
	createSignupInvite: vi.fn(async (email: string) => ({ rawToken: `tok-${email}`, expiresAt: new Date() })),
}));
vi.mock("@/lib/utils/server/email/emails", () => ({ sendPageInviteEmails: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/server", async (orig) => ({
	...(await orig<typeof import("next/server")>()),
	// Run deferred work inline so the send is observable.
	after: (fn: () => unknown) => fn(),
}));

import {
	approveRequestAction,
	cancelEmailInviteAction,
	changeMemberRoleAction,
	denyRequestAction,
	inviteByEmailAction,
	inviteMemberAction,
	joinPageAction,
	leavePageAction,
	removeMemberAction,
} from "@/lib/actions/membership";
import { removeFollowerAction } from "@/lib/actions/follow";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { emitActivity } from "@/lib/utils/server/activity";
import { sendPageInviteEmails } from "@/lib/utils/server/email/emails";
import { EMAIL_INVITE_DAILY_CAP } from "@/lib/const/email-invites";
import { refresh } from "next/cache";

// --- seam helpers -----------------------------------------------------------

function asViewer(userId: string | null) {
	vi.mocked(getSessionContext).mockResolvedValue(userId ? { userId, activePageId: null } : (null as never));
}

/** Who holds which role on page p1; drives every permission lookup the real helpers make. */
function setRoles(roles: Record<string, PermissionRole>) {
	vi.mocked(prisma.permission.findUnique).mockImplementation((async (args: {
		where: { userId_resourceId_resourceType: { userId: string } };
	}) => {
		const role = roles[args.where.userId_resourceId_resourceType.userId];
		return role ? { role } : null;
	}) as never);
	vi.mocked(prisma.permission.findFirst).mockImplementation((async (args: {
		where: { userId: string; role: { in: PermissionRole[] } };
	}) => {
		const role = roles[args.where.userId];
		return role && args.where.role.in.includes(role) ? { role } : null;
	}) as never);
	vi.mocked(prisma.permission.count).mockResolvedValue(
		Object.values(roles).filter((r) => r === PermissionRole.ADMIN).length as never,
	);
}

function setPolicy(membershipPolicy: string) {
	vi.mocked(prisma.page.findUnique).mockResolvedValue({
		id: "p1",
		name: "Secret Workshop",
		membershipPolicy,
	} as never);
}

beforeEach(() => {
	vi.clearAllMocks();
	asViewer("admin");
	setRoles({ admin: PermissionRole.ADMIN });
	setPolicy("INVITE_ONLY");
	vi.mocked(prisma.$transaction).mockImplementation((async (cb: (tx: typeof prisma) => unknown) => cb(prisma)) as never);
	vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u2", displayName: "Sam", handle: "sam" } as never);
	vi.mocked(prisma.user.findMany).mockResolvedValue([]);
	vi.mocked(prisma.accessRequest.findFirst).mockResolvedValue(null);
	vi.mocked(prisma.accessRequest.create).mockResolvedValue({ id: "r1" } as never);
	vi.mocked(prisma.accessRequest.deleteMany).mockResolvedValue({ count: 1 } as never);
	vi.mocked(prisma.follow.deleteMany).mockResolvedValue({ count: 1 } as never);
	vi.mocked(prisma.pageEmailInvite.count).mockResolvedValue(0 as never);
	vi.mocked(prisma.pageEmailInvite.createManyAndReturn).mockImplementation((async (args: {
		data: { pageId: string; email: string; role: PermissionRole; note: string | null }[];
	}) => args.data.map((d, i) => ({ id: `row${i}`, ...d }))) as never);
});

// --- invite -----------------------------------------------------------------

describe("inviteMemberAction", () => {
	const invite = (role: string) => inviteMemberAction({ pageId: "p1", userId: "u2", role });

	test("signed out → unauthorized", async () => {
		asViewer(null);
		expect(await invite("EDITOR")).toMatchObject({ ok: false, error: "unauthorized" });
	});

	test("non-admin → forbidden, nothing created", async () => {
		asViewer("rando");
		expect(await invite("EDITOR")).toMatchObject({ ok: false, error: "forbidden" });
		expect(prisma.accessRequest.create).not.toHaveBeenCalled();
	});

	test("a role the page won't offer (MEMBER on a CLOSED page) → invalid, nothing created", async () => {
		setPolicy("CLOSED");
		expect(await invite(PermissionRole.MEMBER)).toMatchObject({ ok: false, error: "invalid" });
		expect(prisma.accessRequest.create).not.toHaveBeenCalled();
	});

	test("an unknown role → invalid", async () => {
		expect(await invite("OWNER")).toMatchObject({ ok: false, error: "invalid" });
	});

	test("an offered role → invited: an open request, no grant", async () => {
		expect(await invite(PermissionRole.EDITOR)).toEqual({ ok: true, data: undefined });
		expect(prisma.accessRequest.create).toHaveBeenCalled();
		expect(prisma.permission.upsert).not.toHaveBeenCalled();
		expect(emitActivity).toHaveBeenCalledWith(
			"membership.invited",
			{ type: "PAGE", id: "p1" },
			{ type: "USER", id: "u2" },
			{ role: PermissionRole.EDITOR },
		);
	});

	test("someone who already has a role → conflict", async () => {
		setRoles({ admin: PermissionRole.ADMIN, u2: PermissionRole.MEMBER });
		expect(await invite(PermissionRole.EDITOR)).toMatchObject({ ok: false, error: "conflict" });
		expect(prisma.accessRequest.create).not.toHaveBeenCalled();
	});
});

// --- change role / remove ---------------------------------------------------

describe("changeMemberRoleAction", () => {
	const change = (role: string) => changeMemberRoleAction({ pageId: "p1", userId: "u2", role });

	beforeEach(() => setRoles({ admin: PermissionRole.ADMIN, u2: PermissionRole.ADMIN }));

	test("non-admin → forbidden", async () => {
		asViewer("rando");
		expect(await change(PermissionRole.EDITOR)).toMatchObject({ ok: false, error: "forbidden" });
		expect(prisma.permission.upsert).not.toHaveBeenCalled();
	});

	test("demote to MEMBER on a CLOSED page → invalid, no write", async () => {
		setPolicy("CLOSED");
		expect(await change(PermissionRole.MEMBER)).toMatchObject({ ok: false, error: "invalid" });
		expect(prisma.permission.upsert).not.toHaveBeenCalled();
	});

	test("MEMBER is allowed once the page invites members, and the change is announced", async () => {
		expect(await change(PermissionRole.MEMBER)).toEqual({ ok: true, data: undefined });
		expect(prisma.permission.upsert).toHaveBeenCalled();
		expect(emitActivity).toHaveBeenCalledWith("role.changed", { type: "PAGE", id: "p1" }, { type: "USER", id: "u2" });
	});

	test("the same role again writes quietly (no announcement)", async () => {
		expect(await change(PermissionRole.ADMIN)).toEqual({ ok: true, data: undefined });
		expect(emitActivity).not.toHaveBeenCalled();
	});

	test("demoting the sole admin → invalid", async () => {
		setRoles({ admin: PermissionRole.EDITOR, u2: PermissionRole.ADMIN });
		vi.mocked(prisma.permission.findFirst).mockResolvedValue({ role: PermissionRole.ADMIN } as never); // caller still manages
		expect(await change(PermissionRole.EDITOR)).toMatchObject({ ok: false, error: "invalid" });
		expect(prisma.permission.upsert).not.toHaveBeenCalled();
	});

	test("someone with no role → invalid (they need an invite)", async () => {
		setRoles({ admin: PermissionRole.ADMIN });
		expect(await change(PermissionRole.EDITOR)).toMatchObject({ ok: false, error: "invalid" });
		expect(prisma.permission.upsert).not.toHaveBeenCalled();
	});
});

describe("removeMemberAction", () => {
	const remove = (userId = "u2") => removeMemberAction({ pageId: "p1", userId });

	test("non-admin → forbidden", async () => {
		asViewer("rando");
		expect(await remove()).toMatchObject({ ok: false, error: "forbidden" });
		expect(prisma.permission.deleteMany).not.toHaveBeenCalled();
	});

	test("drops the role and the follow together", async () => {
		setRoles({ admin: PermissionRole.ADMIN, u2: PermissionRole.EDITOR });
		expect(await remove()).toEqual({ ok: true, data: undefined });
		expect(prisma.permission.deleteMany).toHaveBeenCalled();
		expect(prisma.follow.deleteMany).toHaveBeenCalledWith({ where: { followerId: "u2", followingPageId: "p1" } });
	});

	test("the last admin can't be removed", async () => {
		expect(await remove("admin")).toMatchObject({ ok: false, error: "invalid" });
		expect(prisma.permission.deleteMany).not.toHaveBeenCalled();
	});
});

// --- join / leave -----------------------------------------------------------

describe("joinPageAction", () => {
	beforeEach(() => {
		asViewer("u1");
		setRoles({});
	});

	test("CLOSED page → not_found, no request", async () => {
		setPolicy("CLOSED");
		expect(await joinPageAction({ pageId: "p1" })).toMatchObject({ ok: false, error: "not_found" });
		expect(prisma.accessRequest.create).not.toHaveBeenCalled();
	});

	test("REQUEST_TO_JOIN, no role → a pending request, no membership", async () => {
		setPolicy("REQUEST_TO_JOIN");
		expect(await joinPageAction({ pageId: "p1" })).toEqual({ ok: true, data: undefined });
		expect(prisma.accessRequest.create).toHaveBeenCalled();
		expect(prisma.permission.upsert).not.toHaveBeenCalled();
	});

	test("an admin can't self-downgrade through the join flow → conflict", async () => {
		setPolicy("REQUEST_TO_JOIN");
		setRoles({ u1: PermissionRole.ADMIN });
		expect(await joinPageAction({ pageId: "p1" })).toMatchObject({ ok: false, error: "conflict" });
		expect(prisma.accessRequest.create).not.toHaveBeenCalled();
	});

	test("an existing member is a no-op", async () => {
		setPolicy("REQUEST_TO_JOIN");
		setRoles({ u1: PermissionRole.MEMBER });
		expect(await joinPageAction({ pageId: "p1" })).toEqual({ ok: true, data: undefined });
		expect(prisma.accessRequest.create).not.toHaveBeenCalled();
	});
});

describe("leavePageAction", () => {
	test("signed out → unauthorized", async () => {
		asViewer(null);
		expect(await leavePageAction({ pageId: "p1" })).toMatchObject({ ok: false, error: "unauthorized" });
	});

	test("the sole admin can't leave: role kept (last-admin guard)", async () => {
		const result = await leavePageAction({ pageId: "p1" });
		expect(result).toMatchObject({ ok: false, error: "invalid" });
		expect(prisma.permission.deleteMany).not.toHaveBeenCalled();
	});

	test("an ordinary member can leave: role revoked", async () => {
		asViewer("u1");
		setRoles({ admin: PermissionRole.ADMIN, u1: PermissionRole.MEMBER });
		expect(await leavePageAction({ pageId: "p1" })).toEqual({ ok: true, data: undefined });
		expect(prisma.permission.deleteMany).toHaveBeenCalledWith({
			where: { userId: "u1", resourceId: "p1", resourceType: "PAGE" },
		});
	});

	test("no role → withdraws any pending join request", async () => {
		asViewer("u1");
		setRoles({ admin: PermissionRole.ADMIN });
		expect(await leavePageAction({ pageId: "p1" })).toEqual({ ok: true, data: undefined });
		expect(prisma.accessRequest.deleteMany).toHaveBeenCalled();
		expect(prisma.permission.deleteMany).not.toHaveBeenCalled();
	});
});

// --- approve / deny ---------------------------------------------------------

describe("approve / deny request actions", () => {
	test("unknown request → not_found", async () => {
		vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(null);
		expect(await approveRequestAction({ requestId: "nope" })).toMatchObject({ ok: false, error: "not_found" });
		expect(await denyRequestAction({ requestId: "nope" })).toMatchObject({ ok: false, error: "not_found" });
	});

	test("accepting an invite after the page closes withdraws it, explains, and refreshes", async () => {
		asViewer("u2");
		setPolicy("CLOSED");
		vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
			id: "r1",
			kind: "INVITE",
			role: PermissionRole.MEMBER,
			requesterId: null,
			requesterPageId: "p1",
			targetUserId: "u2",
			targetPageId: null,
		} as never);
		expect(await approveRequestAction({ requestId: "r1" })).toEqual({
			ok: false,
			error: "conflict",
			message: "That invite is no longer available",
		});
		expect(prisma.accessRequest.delete).toHaveBeenCalledWith({ where: { id: "r1" } });
		expect(prisma.permission.upsert).not.toHaveBeenCalled();
		expect(refresh).toHaveBeenCalled();
	});

	test("an invite addressed to someone else can't be accepted → forbidden", async () => {
		vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
			id: "r1",
			kind: "INVITE",
			role: PermissionRole.EDITOR,
			requesterId: null,
			requesterPageId: "p1",
			targetUserId: "someone-else",
			targetPageId: null,
		} as never);
		expect(await approveRequestAction({ requestId: "r1" })).toMatchObject({ ok: false, error: "forbidden" });
		expect(prisma.permission.upsert).not.toHaveBeenCalled();
	});

	test("the page's admin can cancel its own outgoing invite", async () => {
		vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
			id: "r1",
			kind: "INVITE",
			role: PermissionRole.EDITOR,
			requesterId: null,
			requesterPageId: "p1",
			targetUserId: "u2",
			targetPageId: null,
		} as never);
		vi.mocked(prisma.accessRequest as unknown as { delete: ReturnType<typeof vi.fn> }).delete = vi.fn();
		expect(await denyRequestAction({ requestId: "r1" })).toEqual({ ok: true, data: undefined });
	});
});

// --- invite by email --------------------------------------------------------

describe("inviteByEmailAction", () => {
	const send = (input: { emails?: unknown; role?: string; note?: unknown } = {}) =>
		inviteByEmailAction({
			pageId: "p1",
			emails: ["new@example.com"],
			role: "MEMBER",
			...input,
		} as never);

	test("non-admin → forbidden, nothing sent", async () => {
		asViewer("rando");
		expect(await send()).toMatchObject({ ok: false, error: "forbidden" });
		expect(prisma.pageEmailInvite.createManyAndReturn).not.toHaveBeenCalled();
		expect(sendPageInviteEmails).not.toHaveBeenCalled();
	});

	test("signed out → unauthorized", async () => {
		asViewer(null);
		expect(await send()).toMatchObject({ ok: false, error: "unauthorized" });
	});

	test("bad role / bad emails / long note → invalid", async () => {
		expect(await send({ role: "OWNER" })).toMatchObject({ ok: false, error: "invalid" });
		expect(await send({ emails: "a@example.com" })).toMatchObject({ ok: false, error: "invalid" });
		expect(await send({ note: "x".repeat(281) })).toMatchObject({ ok: false, error: "invalid" });
		expect(prisma.pageEmailInvite.createManyAndReturn).not.toHaveBeenCalled();
	});

	test("a role the page won't offer → invalid", async () => {
		setPolicy("CLOSED");
		expect(await send({ role: "MEMBER" })).toMatchObject({ ok: false, error: "invalid" });
	});

	test("over the daily cap → rate_limited, naming what's left, nothing created", async () => {
		vi.mocked(prisma.pageEmailInvite.count).mockResolvedValue((EMAIL_INVITE_DAILY_CAP - 1) as never);
		const result = await send({ emails: ["a@example.com", "b@example.com"] });
		expect(result).toMatchObject({ ok: false, error: "rate_limited" });
		expect(result.ok === false && result.message).toContain("You have 1 left today");
		expect(prisma.pageEmailInvite.createManyAndReturn).not.toHaveBeenCalled();
		expect(sendPageInviteEmails).not.toHaveBeenCalled();
	});

	test("mails a signup link to addresses without an account, naming the inviter and page", async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue({ displayName: "Sam", handle: "sam" } as never);
		const result = await send({ note: " hi " });
		expect(result).toEqual({ ok: true, data: { sent: 1, alreadyMembers: [] } });
		expect(sendPageInviteEmails).toHaveBeenCalledWith([
			expect.objectContaining({
				to: "new@example.com",
				inviterName: "Sam",
				pageName: "Secret Workshop",
				role: "MEMBER",
				note: "hi",
				url: expect.stringContaining("invite=tok-new%40example.com"),
			}),
		]);
	});

	test("the outcome is the same whether or not an address had an account", async () => {
		const fresh = await send({ emails: ["new@example.com"] });
		vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "u-alice", email: "alice@example.com" }] as never);
		const existing = await send({ emails: ["alice@example.com"] });
		expect(existing).toEqual(fresh);
	});

	test("an address that already has a role is named, and no signup email goes out for it", async () => {
		vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "u-sam", email: "sam@example.com" }] as never);
		setRoles({ admin: PermissionRole.ADMIN, "u-sam": PermissionRole.MEMBER });
		const result = await send({ emails: ["sam@example.com"] });
		expect(result).toEqual({ ok: true, data: { sent: 0, alreadyMembers: ["sam@example.com"] } });
		expect(sendPageInviteEmails).not.toHaveBeenCalled();
	});
});

describe("cancelEmailInviteAction", () => {
	const cancel = () => cancelEmailInviteAction({ pageId: "p1", inviteId: "e1" });

	test("non-admin → forbidden", async () => {
		asViewer("rando");
		expect(await cancel()).toMatchObject({ ok: false, error: "forbidden" });
		expect(prisma.pageEmailInvite.findFirst).not.toHaveBeenCalled();
	});

	test("unknown invite → not_found; known → ok", async () => {
		vi.mocked(prisma.pageEmailInvite.findFirst).mockResolvedValueOnce(null);
		expect(await cancel()).toMatchObject({ ok: false, error: "not_found" });
		vi.mocked(prisma.pageEmailInvite.findFirst).mockResolvedValueOnce({ id: "e1", claimedUserId: null } as never);
		expect(await cancel()).toEqual({ ok: true, data: undefined });
	});
});

// --- remove follower --------------------------------------------------------

describe("removeFollowerAction", () => {
	test("your own profile: removes the edge, scoped to you", async () => {
		asViewer("me");
		expect(await removeFollowerAction({ target: { type: "user", id: "me" }, followId: "f1" })).toEqual({
			ok: true,
			data: undefined,
		});
		expect(prisma.follow.deleteMany).toHaveBeenCalledWith({ where: { id: "f1", followingUserId: "me" } });
	});

	test("someone else's profile → forbidden, nothing deleted", async () => {
		asViewer("me");
		const result = await removeFollowerAction({ target: { type: "user", id: "other" }, followId: "f1" });
		expect(result).toMatchObject({ ok: false, error: "forbidden" });
		expect(prisma.follow.deleteMany).not.toHaveBeenCalled();
	});

	test("a page needs an admin (real canManagePage)", async () => {
		asViewer("editor");
		setRoles({ admin: PermissionRole.ADMIN, editor: PermissionRole.EDITOR });
		const result = await removeFollowerAction({ target: { type: "page", id: "p1" }, followId: "f1" });
		expect(result).toMatchObject({ ok: false, error: "forbidden" });
		expect(prisma.follow.deleteMany).not.toHaveBeenCalled();

		asViewer("admin");
		expect(await removeFollowerAction({ target: { type: "page", id: "p1" }, followId: "f1" })).toEqual({
			ok: true,
			data: undefined,
		});
		expect(prisma.follow.deleteMany).toHaveBeenCalledWith({ where: { id: "f1", followingPageId: "p1" } });
	});

	test("an edge that doesn't point at the target → not_found", async () => {
		asViewer("me");
		vi.mocked(prisma.follow.deleteMany).mockResolvedValue({ count: 0 } as never);
		expect(await removeFollowerAction({ target: { type: "user", id: "me" }, followId: "f-other" })).toMatchObject({
			ok: false,
			error: "not_found",
		});
	});

	test("a malformed target → invalid", async () => {
		asViewer("me");
		expect(await removeFollowerAction({ target: { type: "group", id: "x" } as never, followId: "f1" })).toMatchObject({
			ok: false,
			error: "invalid",
		});
	});
});
