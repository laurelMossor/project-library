/**
 * Route tests for GET /api/health. The endpoint deliberately exercises the real
 * read paths (Post/Event collection queries + User) so a schema/migration drift —
 * the 04/19 failure mode where the site + DB were up but the collections query hit
 * a missing column — surfaces as a 503. A bare `SELECT 1` would have passed then.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
	$queryRaw: vi.fn(),
	post: { findFirst: vi.fn() },
	event: { findFirst: vi.fn() },
	user: { findFirst: vi.fn() },
}));

vi.mock("@/lib/utils/server/prisma", () => ({ prisma: prismaMock }));

// The real in-memory rate limiter is used (not mocked) so we can assert the 429 path.
import { GET } from "@/app/api/health/route";

// Each request needs an IP so the limiter can key on it. Distinct IPs land in
// distinct buckets, which keeps tests from draining each other's quota.
const req = (ip?: string) =>
	new Request("http://localhost/api/health", {
		headers: ip ? { "x-forwarded-for": ip } : {},
	});

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

afterEach(() => {
	// NODE_ENV is typed read-only; vi.stubEnv is the supported way to override it.
	vi.unstubAllEnvs();
});

describe("GET /api/health", () => {
	test("all probes pass → 200, status ok, all checks true", async () => {
		const res = await GET(req("1.0.0.1"));
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
		const res = await GET(req("1.0.0.2"));
		expect(res.status).toBe(503);
		const body = await res.json();
		expect(body.status).toBe("error");
		expect(body.checks.db).toBe(true); // connectivity was fine...
		expect(body.checks.posts).toBe(false); // ...the collections read path is what broke
	});

	test("prod: 503 body carries a generic message and never the raw error", async () => {
		vi.stubEnv("NODE_ENV", "production");
		prismaMock.post.findFirst.mockRejectedValue(
			new Error('column "topics" does not exist')
		);
		const res = await GET(req("1.0.0.3"));
		expect(res.status).toBe(503);
		const body = await res.json();
		expect(body.error).toBe("Health check failed");
		expect(body).not.toHaveProperty("detail"); // raw Prisma message not leaked
		expect(JSON.stringify(body)).not.toContain("topics"); // no schema internals
		expect(body.checks.posts).toBe(false); // operator can still see which probe failed
	});

	test("non-prod: 503 body includes the raw message as `detail` for local debugging", async () => {
		vi.stubEnv("NODE_ENV", "development");
		prismaMock.post.findFirst.mockRejectedValue(
			new Error('column "topics" does not exist')
		);
		const res = await GET(req("1.0.0.4"));
		expect(res.status).toBe(503);
		const body = await res.json();
		expect(body.error).toBe("Health check failed");
		expect(body.detail).toContain("topics");
	});

	test("DB connectivity fails → 503; db false", async () => {
		prismaMock.$queryRaw.mockRejectedValue(new Error("connection refused"));
		const res = await GET(req("1.0.0.5"));
		expect(res.status).toBe(503);
		const body = await res.json();
		expect(body.checks.db).toBe(false);
		expect(body.checks.posts).toBe(false);
	});

	test("missing required env → 503 even if all queries pass", async () => {
		delete process.env.AUTH_SECRET;
		const res = await GET(req("1.0.0.6"));
		expect(res.status).toBe(503);
		const body = await res.json();
		expect(body.checks.config).toBe(false);
	});

	test("rate limit: 61st request from one IP within the window → 429", async () => {
		const ip = "9.9.9.9"; // distinct bucket so other tests keep their quota
		for (let i = 0; i < 60; i++) {
			const ok = await GET(req(ip));
			expect(ok.status).toBe(200);
		}
		const limited = await GET(req(ip));
		expect(limited.status).toBe(429);
	});
});
