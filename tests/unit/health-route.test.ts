/**
 * Route tests for GET /api/health. The endpoint deliberately exercises the real
 * read paths (Post/Event collection queries + User) so a schema/migration drift —
 * the 04/19 failure mode where the site + DB were up but the collections query hit
 * a missing column — surfaces as a 503. A bare `SELECT 1` would have passed then.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
	$queryRaw: vi.fn(),
	post: { findFirst: vi.fn() },
	event: { findFirst: vi.fn() },
	user: { findFirst: vi.fn() },
}));

vi.mock("@/lib/utils/server/prisma", () => ({ prisma: prismaMock }));

import { GET } from "@/app/api/health/route";

beforeEach(() => {
	vi.clearAllMocks();
	process.env.AUTH_SECRET = "test-secret";
	process.env.DATABASE_URL = "postgresql://test";
	process.env.DIRECT_URL = "postgresql://test";
	// Default: everything healthy. `null` from findFirst (empty table) is healthy —
	// the signal is that the query executes, not that rows exist.
	prismaMock.$queryRaw.mockResolvedValue([{ ok: 1 }]);
	prismaMock.post.findFirst.mockResolvedValue(null);
	prismaMock.event.findFirst.mockResolvedValue(null);
	prismaMock.user.findFirst.mockResolvedValue(null);
});

describe("GET /api/health", () => {
	test("all probes pass → 200, status ok, all checks true", async () => {
		const res = await GET();
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.status).toBe("ok");
		expect(body.checks).toEqual({
			config: true,
			db: true,
			posts: true,
			events: true,
			users: true,
		});
	});

	test("content query throws (missing column / schema drift) → 503; db ok, posts not ok", async () => {
		prismaMock.post.findFirst.mockRejectedValue(
			new Error('column "topics" does not exist')
		);
		const res = await GET();
		expect(res.status).toBe(503);
		const body = await res.json();
		expect(body.status).toBe("error");
		expect(body.checks.db).toBe(true); // connectivity was fine...
		expect(body.checks.posts).toBe(false); // ...the collections read path is what broke
	});

	test("DB connectivity fails → 503; db false", async () => {
		prismaMock.$queryRaw.mockRejectedValue(new Error("connection refused"));
		const res = await GET();
		expect(res.status).toBe(503);
		const body = await res.json();
		expect(body.checks.db).toBe(false);
		expect(body.checks.posts).toBe(false);
	});

	test("missing required env → 503 even if all queries pass", async () => {
		delete process.env.AUTH_SECRET;
		const res = await GET();
		expect(res.status).toBe(503);
		const body = await res.json();
		expect(body.checks.config).toBe(false);
	});
});
