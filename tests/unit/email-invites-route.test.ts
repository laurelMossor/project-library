/**
 * POST /api/pages/[pageId]/email-invites and DELETE …/[inviteId]. The choke point (requests.ts)
 * and the email sender are mocked; this locks the gate (admin only), input validation, the cap's
 * 429, and that the response is the same whichever addresses had accounts.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  // Run deferred work inline so the send is observable.
  after: (fn: () => unknown) => fn(),
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/permission", () => ({ canManagePage: vi.fn() }));
vi.mock("@/lib/utils/server/requests", () => ({
  invitePageMembersByEmail: vi.fn(),
  cancelPageEmailInvite: vi.fn(),
}));
vi.mock("@/lib/utils/server/email/emails", () => ({ sendPageInviteEmails: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("@/lib/utils/server/signup-invite", () => ({ SIGNUP_INVITE_TTL_DAYS: 14 }));
vi.mock("@/lib/utils/server/log", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: { user: { findUnique: vi.fn().mockResolvedValue({ displayName: "Sam", handle: "sam" }) } },
}));
vi.mock("@/lib/utils/errors", () => ({
  unauthorized: (msg?: string) => new Response(JSON.stringify({ error: msg ?? "Unauthorized" }), { status: 401 }),
  badRequest: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400 }),
  notFound: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 404 }),
  serverError: (msg?: string) => new Response(JSON.stringify({ error: msg ?? "Internal server error" }), { status: 500 }),
}));

import { POST } from "@/app/api/pages/[pageId]/email-invites/route";
import { DELETE } from "@/app/api/pages/[pageId]/email-invites/[inviteId]/route";
import { getSessionContext } from "@/lib/utils/server/session";
import { canManagePage } from "@/lib/utils/server/permission";
import { invitePageMembersByEmail, cancelPageEmailInvite } from "@/lib/utils/server/requests";
import { sendPageInviteEmails } from "@/lib/utils/server/email/emails";

const ctx = { params: Promise.resolve({ pageId: "p1" }) };
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/pages/p1/email-invites", { method: "POST", body: JSON.stringify(body) }), ctx);
const page = { id: "p1", name: "Secret Workshop" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionContext).mockResolvedValue({ userId: "u-sam" } as never);
  vi.mocked(canManagePage).mockResolvedValue(true);
});

describe("POST email-invites", () => {
  test("non-admin → 401, nothing sent", async () => {
    vi.mocked(canManagePage).mockResolvedValue(false);
    const res = await post({ emails: ["a@example.com"], role: "MEMBER" });
    expect(res.status).toBe(401);
    expect(invitePageMembersByEmail).not.toHaveBeenCalled();
  });

  test("signed out → 401", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(null);
    expect((await post({ emails: ["a@example.com"], role: "MEMBER" })).status).toBe(401);
  });

  test("bad role / bad emails / long note → 400", async () => {
    expect((await post({ emails: ["a@example.com"], role: "OWNER" })).status).toBe(400);
    expect((await post({ emails: "a@example.com", role: "MEMBER" })).status).toBe(400);
    expect((await post({ emails: ["a@example.com"], role: "MEMBER", note: "x".repeat(281) })).status).toBe(400);
    expect(invitePageMembersByEmail).not.toHaveBeenCalled();
  });

  test("over the cap → 429 with what's left", async () => {
    vi.mocked(invitePageMembersByEmail).mockResolvedValue({ ok: false, reason: "over_cap", remaining: 3 });
    const res = await post({ emails: ["a@example.com"], role: "MEMBER" });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ remaining: 3 });
    expect(sendPageInviteEmails).not.toHaveBeenCalled();
  });

  test("emails only the addresses without an account, naming the inviter and page", async () => {
    vi.mocked(invitePageMembersByEmail).mockResolvedValue({
      ok: true,
      sent: 2,
      page,
      signupInvites: [{ email: "new@example.com", rawToken: "tok" }],
      alreadyMembers: [],
    });
    const res = await post({ emails: ["alice@example.com", "new@example.com"], role: "MEMBER", note: " hi " });
    expect(res.status).toBe(201);
    expect(sendPageInviteEmails).toHaveBeenCalledWith([
      expect.objectContaining({
        to: "new@example.com",
        inviterName: "Sam",
        pageName: "Secret Workshop",
        role: "MEMBER",
        note: "hi",
        url: expect.stringContaining("invite=tok"),
      }),
    ]);
  });

  test("the response is identical whether or not an address had an account", async () => {
    vi.mocked(invitePageMembersByEmail).mockResolvedValueOnce({
      ok: true, sent: 1, page, signupInvites: [], alreadyMembers: [],
    });
    const existing = await (await post({ emails: ["alice@example.com"], role: "MEMBER" })).json();
    vi.mocked(invitePageMembersByEmail).mockResolvedValueOnce({
      ok: true,
      sent: 1,
      page,
      signupInvites: [{ email: "new@example.com", rawToken: "tok" }],
      alreadyMembers: [],
    });
    const fresh = await (await post({ emails: ["new@example.com"], role: "MEMBER" })).json();
    expect(existing).toEqual(fresh);
    expect(existing).toEqual({ status: "invited", sent: 1, alreadyMembers: [] });
  });

  test("addresses that already have a role are named, and no signup email goes out for them", async () => {
    vi.mocked(invitePageMembersByEmail).mockResolvedValue({
      ok: true,
      sent: 0,
      page,
      signupInvites: [],
      alreadyMembers: ["sam@example.com"],
    });
    const res = await post({ emails: ["sam@example.com"], role: "MEMBER" });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      status: "invited",
      sent: 0,
      alreadyMembers: ["sam@example.com"],
    });
    expect(sendPageInviteEmails).not.toHaveBeenCalled();
  });
});

describe("DELETE email-invite", () => {
  const del = () =>
    DELETE(new Request("http://localhost/x", { method: "DELETE" }), {
      params: Promise.resolve({ pageId: "p1", inviteId: "e1" }),
    });

  test("non-admin → 401", async () => {
    vi.mocked(canManagePage).mockResolvedValue(false);
    expect((await del()).status).toBe(401);
    expect(cancelPageEmailInvite).not.toHaveBeenCalled();
  });

  test("unknown invite → 404; known → 200", async () => {
    vi.mocked(cancelPageEmailInvite).mockResolvedValueOnce(false);
    expect((await del()).status).toBe(404);
    vi.mocked(cancelPageEmailInvite).mockResolvedValueOnce(true);
    expect((await del()).status).toBe(200);
  });
});
