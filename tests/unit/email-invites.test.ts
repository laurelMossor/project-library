/**
 * Invite-by-email choke point — invitePageMembersByEmail / claimPageEmailInvites /
 * listPageEmailInvites / cancelPageEmailInvite. Prisma, the signup-token mint, and the
 * notification seam are mocked.
 *
 * The load-bearing invariants: the daily cap is enforced before anything is created; an address
 * with an account is claimed into a normal invite and the result never says so; and a pending
 * email invite never surfaces the account behind it.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { PermissionRole } from "@prisma/client";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: {
    page: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    accessRequest: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    pageEmailInvite: {
      count: vi.fn(),
      updateMany: vi.fn(),
      createManyAndReturn: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/utils/server/permission", () => ({
  canManagePage: vi.fn(),
  getUserPermission: vi.fn(),
  grantPermission: vi.fn(),
  revokePermission: vi.fn(),
}));
vi.mock("@/lib/utils/server/activity", () => ({ emitActivity: vi.fn() }));
vi.mock("@/lib/utils/server/signup-invite", () => ({
  createSignupInvite: vi.fn(async (email: string) => ({ rawToken: `tok-${email}`, expiresAt: new Date() })),
}));

import {
  invitePageMembersByEmail,
  claimPageEmailInvites,
  listPageEmailInvites,
  cancelPageEmailInvite,
} from "@/lib/utils/server/requests";
import { prisma } from "@/lib/utils/server/prisma";
import { getUserPermission } from "@/lib/utils/server/permission";
import { emitActivity } from "@/lib/utils/server/activity";
import { createSignupInvite } from "@/lib/utils/server/signup-invite";

const page = { id: "p1", name: "Secret Workshop", membershipPolicy: "INVITE_ONLY" };

/** createManyAndReturn echoes the rows it was given, with ids. */
function echoCreatedRows() {
  vi.mocked(prisma.pageEmailInvite.createManyAndReturn).mockImplementation((async (args: {
    data: { pageId: string; email: string; role: PermissionRole; note: string | null }[];
  }) => args.data.map((d, i) => ({ id: `row${i}`, ...d }))) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation((async (cb: (tx: typeof prisma) => unknown) => cb(prisma)) as never);
  vi.mocked(prisma.page.findUnique).mockResolvedValue(page as never);
  vi.mocked(prisma.pageEmailInvite.count).mockResolvedValue(0);
  vi.mocked(prisma.user.findMany).mockResolvedValue([]);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u-alice" } as never);
  vi.mocked(prisma.accessRequest.findFirst).mockResolvedValue(null);
  vi.mocked(getUserPermission).mockResolvedValue(null);
  echoCreatedRows();
});

const base = { pageId: "p1", inviterId: "u-sam", role: PermissionRole.MEMBER };

describe("invitePageMembersByEmail", () => {
  test("new addresses get a signup token each; nothing is claimed", async () => {
    const res = await invitePageMembersByEmail({ ...base, emails: ["New@Example.com ", "other@example.com"] });
    expect(res).toMatchObject({ ok: true, sent: 2, page: { id: "p1", name: "Secret Workshop" } });
    expect(res.ok && res.signupInvites.map((s) => s.email)).toEqual(["new@example.com", "other@example.com"]);
    expect(createSignupInvite).toHaveBeenCalledTimes(2);
    expect(prisma.accessRequest.create).not.toHaveBeenCalled();
  });

  test("an address with an account is claimed into a normal invite — and the result doesn't say so", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "u-alice", email: "alice@example.com" }] as never);
    const res = await invitePageMembersByEmail({ ...base, emails: ["alice@example.com", "new@example.com"], note: "Come build" });

    // Same shape as an all-new batch: a count, no per-address outcome.
    expect(res).toMatchObject({ ok: true, sent: 2 });
    expect(res.ok && res.signupInvites.map((s) => s.email)).toEqual(["new@example.com"]);
    expect(prisma.accessRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ requesterPageId: "p1", targetUserId: "u-alice", role: "MEMBER", note: "Come build" }),
    });
    expect(emitActivity).toHaveBeenCalledWith(
      "membership.invited",
      { type: "PAGE", id: "p1" },
      { type: "USER", id: "u-alice" },
      { role: "MEMBER" },
    );
    expect(prisma.pageEmailInvite.update).toHaveBeenCalledWith({
      where: { id: "row0" },
      data: expect.objectContaining({ claimedUserId: "u-alice" }),
    });
  });

  test("an address that's already a member stays a pending email row — nothing reveals the membership", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "u-sam2", email: "sam@example.com" }] as never);
    vi.mocked(getUserPermission).mockResolvedValue({ role: "EDITOR" } as never);
    const res = await invitePageMembersByEmail({ ...base, emails: ["sam@example.com"] });

    expect(res).toMatchObject({ ok: true, sent: 1, signupInvites: [] });
    expect(prisma.accessRequest.create).not.toHaveBeenCalled();
    expect(emitActivity).not.toHaveBeenCalled();
    // Neither claimed nor cancelled: listPageEmailInvites keeps showing it, like an unanswered invite.
    expect(prisma.pageEmailInvite.update).not.toHaveBeenCalled();
  });

  test("over the daily cap → refused before any row, token, or invite", async () => {
    vi.mocked(prisma.pageEmailInvite.count).mockResolvedValue(19);
    const res = await invitePageMembersByEmail({ ...base, emails: ["a@example.com", "b@example.com"] });
    expect(res).toEqual({ ok: false, reason: "over_cap", remaining: 1 });
    expect(prisma.pageEmailInvite.createManyAndReturn).not.toHaveBeenCalled();
    expect(createSignupInvite).not.toHaveBeenCalled();
  });

  test("exactly reaching the cap is allowed", async () => {
    vi.mocked(prisma.pageEmailInvite.count).mockResolvedValue(19);
    const res = await invitePageMembersByEmail({ ...base, emails: ["a@example.com"] });
    expect(res.ok).toBe(true);
  });

  test("the cap counts this admin's sends in the last 24 hours", async () => {
    await invitePageMembersByEmail({ ...base, emails: ["a@example.com"] });
    const where = vi.mocked(prisma.pageEmailInvite.count).mock.calls[0][0]!.where!;
    expect(where.invitedById).toBe("u-sam");
    const since = (where.createdAt as { gte: Date }).gte.getTime();
    expect(Date.now() - since).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(Date.now() - since).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
  });

  test("MEMBER on a CLOSED page → invalid_role, nothing sent", async () => {
    vi.mocked(prisma.page.findUnique).mockResolvedValue({ ...page, membershipPolicy: "CLOSED" } as never);
    const res = await invitePageMembersByEmail({ ...base, emails: ["a@example.com"] });
    expect(res).toEqual({ ok: false, reason: "invalid_role" });
    expect(prisma.pageEmailInvite.createManyAndReturn).not.toHaveBeenCalled();
  });

  test("any invalid address rejects the whole batch", async () => {
    const res = await invitePageMembersByEmail({ ...base, emails: ["a@example.com", "not-an-email"] });
    expect(res).toEqual({ ok: false, reason: "invalid_emails" });
    expect(prisma.pageEmailInvite.createManyAndReturn).not.toHaveBeenCalled();
  });

  test("duplicates collapse; an empty list is refused", async () => {
    const res = await invitePageMembersByEmail({ ...base, emails: ["a@example.com", "A@example.com"] });
    expect(res).toMatchObject({ ok: true, sent: 1 });
    expect(await invitePageMembersByEmail({ ...base, emails: ["  "] })).toEqual({ ok: false, reason: "no_emails" });
  });

  test("a newer send supersedes the page's earlier row for the same address", async () => {
    await invitePageMembersByEmail({ ...base, emails: ["a@example.com"] });
    expect(prisma.pageEmailInvite.updateMany).toHaveBeenCalledWith({
      where: { pageId: "p1", email: { in: ["a@example.com"] }, cancelledAt: null },
      data: { cancelledAt: expect.any(Date) },
    });
  });

  test("the note is trimmed and capped", async () => {
    await invitePageMembersByEmail({ ...base, emails: ["a@example.com"], note: `  ${"x".repeat(400)}  ` });
    const { data } = vi.mocked(prisma.pageEmailInvite.createManyAndReturn).mock.calls[0][0] as unknown as {
      data: { note: string }[];
    };
    expect(data[0].note).toHaveLength(280);
  });
});

describe("claimPageEmailInvites (at signup)", () => {
  test("opens a normal invite for each waiting row and marks it claimed", async () => {
    vi.mocked(prisma.pageEmailInvite.findMany).mockResolvedValue([
      { id: "e1", pageId: "p1", role: "MEMBER", note: "hi" },
    ] as never);
    await claimPageEmailInvites("u-new", "New@Example.com");

    expect(prisma.pageEmailInvite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "new@example.com", claimedAt: null, cancelledAt: null } }),
    );
    expect(prisma.accessRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ targetUserId: "u-new", requesterPageId: "p1", note: "hi" }),
    });
    expect(prisma.pageEmailInvite.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { claimedAt: expect.any(Date), claimedUserId: "u-new" },
    });
  });

  test("a page that can no longer offer the role → row cancelled, no invite", async () => {
    vi.mocked(prisma.page.findUnique).mockResolvedValue({ ...page, membershipPolicy: "CLOSED" } as never);
    vi.mocked(prisma.pageEmailInvite.findMany).mockResolvedValue([
      { id: "e1", pageId: "p1", role: "MEMBER", note: null },
    ] as never);
    await claimPageEmailInvites("u-new", "new@example.com");
    expect(prisma.accessRequest.create).not.toHaveBeenCalled();
    expect(prisma.pageEmailInvite.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { cancelledAt: expect.any(Date) },
    });
  });
});

describe("listPageEmailInvites", () => {
  test("keeps claimed-but-unaccepted invites as email rows, so the account isn't revealed", async () => {
    vi.mocked(prisma.accessRequest.findMany).mockResolvedValue([{ targetUserId: "u-alice" }] as never);
    vi.mocked(prisma.pageEmailInvite.findMany).mockResolvedValue([]);
    await listPageEmailInvites("p1");
    expect(prisma.pageEmailInvite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          pageId: "p1",
          cancelledAt: null,
          OR: [{ claimedAt: null }, { claimedUserId: { in: ["u-alice"] } }],
        },
      }),
    );
  });
});

describe("cancelPageEmailInvite", () => {
  test("a claimed row also withdraws the open in-app invite", async () => {
    vi.mocked(prisma.pageEmailInvite.findFirst).mockResolvedValue({ id: "e1", claimedUserId: "u-alice" } as never);
    expect(await cancelPageEmailInvite("p1", "e1")).toBe(true);
    expect(prisma.accessRequest.deleteMany).toHaveBeenCalledWith({
      where: { kind: "INVITE", requesterPageId: "p1", targetUserId: "u-alice" },
    });
  });

  test("an unclaimed row just cancels", async () => {
    vi.mocked(prisma.pageEmailInvite.findFirst).mockResolvedValue({ id: "e1", claimedUserId: null } as never);
    expect(await cancelPageEmailInvite("p1", "e1")).toBe(true);
    expect(prisma.accessRequest.deleteMany).not.toHaveBeenCalled();
  });

  test("another page's (or an already-cancelled) row → false", async () => {
    vi.mocked(prisma.pageEmailInvite.findFirst).mockResolvedValue(null);
    expect(await cancelPageEmailInvite("p1", "e-other")).toBe(false);
    expect(prisma.pageEmailInvite.update).not.toHaveBeenCalled();
  });
});
