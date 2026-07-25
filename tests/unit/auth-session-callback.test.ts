/**
 * Regression tests for the NextAuth session callback (resolveSession).
 *
 * The core guard: a session whose JWT epoch (tokenVersion) no longer matches the user's
 * current tokenVersion — e.g. after a password reset — must be presented as fully
 * unauthenticated, with `user` cleared ENTIRELY (no lingering email/name). Leaving the email
 * behind is what let the UI claim "logged in as X" when there was no valid login.
 *
 * Prisma is mocked so no DB/NextAuth server is needed.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: { user: { findUnique: vi.fn() } },
}));

import { resolveSession } from "@/lib/utils/server/resolve-session";
import { prisma } from "@/lib/utils/server/prisma";

const findUnique = vi.mocked(prisma.user.findUnique);

// A session as NextAuth hands it to the callback: user populated from the JWT (email/name),
// no id yet — the callback is what stamps (or clears) the id.
const makeSession = () =>
	({ user: { email: "alice@example.com", name: null }, expires: "2099-01-01T00:00:00.000Z" }) as never;

describe("resolveSession", () => {
	beforeEach(() => vi.clearAllMocks());

	test("valid epoch → id stamped, email preserved", async () => {
		findUnique.mockResolvedValue({ tokenVersion: 0 } as never);
		const out = await resolveSession(makeSession(), { sub: "user-1", tokenVersion: 0 } as never);
		expect(out.user?.id).toBe("user-1");
		expect(out.user?.email).toBe("alice@example.com");
	});

	test("stale tokenVersion → user cleared entirely (no id AND no email)", async () => {
		findUnique.mockResolvedValue({ tokenVersion: 5 } as never);
		const out = await resolveSession(makeSession(), { sub: "user-1", tokenVersion: 0 } as never);
		expect(out.user).toBeUndefined();
	});

	test("user no longer exists → user cleared entirely", async () => {
		findUnique.mockResolvedValue(null);
		const out = await resolveSession(makeSession(), { sub: "user-1", tokenVersion: 0 } as never);
		expect(out.user).toBeUndefined();
	});

	test("no token sub (anonymous) → session returned as-is, no DB hit", async () => {
		const out = await resolveSession(makeSession(), {} as never);
		expect(findUnique).not.toHaveBeenCalled();
		expect(out.user?.email).toBe("alice@example.com");
	});

	test("valid epoch with activePageId → carried onto the session", async () => {
		findUnique.mockResolvedValue({ tokenVersion: 2 } as never);
		const out = await resolveSession(
			makeSession(),
			{ sub: "user-1", tokenVersion: 2, activePageId: "page-9" } as never,
		);
		expect(out.user?.id).toBe("user-1");
		expect((out.user as { activePageId?: string })?.activePageId).toBe("page-9");
	});
});
