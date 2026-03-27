import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit } from "@/lib/utils/server/rate-limit";

// Each test uses a unique key to avoid cross-test interference —
// the store is module-level and cannot be reset between tests.
let keyCounter = 0;
function uniqueKey(prefix = "test") {
  return `${prefix}:${++keyCounter}:${Date.now()}`;
}

const OPTS = { maxRequests: 3, windowMs: 60_000 };

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("first request is allowed with remaining = maxRequests - 1", () => {
    const result = checkRateLimit(uniqueKey(), OPTS);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  test("requests up to limit are all allowed and remaining decrements", () => {
    const key = uniqueKey();
    const r1 = checkRateLimit(key, OPTS);
    const r2 = checkRateLimit(key, OPTS);
    const r3 = checkRateLimit(key, OPTS);

    expect(r1).toMatchObject({ allowed: true, remaining: 2 });
    expect(r2).toMatchObject({ allowed: true, remaining: 1 });
    expect(r3).toMatchObject({ allowed: true, remaining: 0 });
  });

  test("request over limit is denied with remaining = 0", () => {
    const key = uniqueKey();
    checkRateLimit(key, OPTS); // 1
    checkRateLimit(key, OPTS); // 2
    checkRateLimit(key, OPTS); // 3 (at limit)

    const over = checkRateLimit(key, OPTS); // 4 — denied
    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);
  });

  test("counter resets after window expires", () => {
    const key = uniqueKey();
    checkRateLimit(key, OPTS); // 1
    checkRateLimit(key, OPTS); // 2
    checkRateLimit(key, OPTS); // 3 (at limit)
    expect(checkRateLimit(key, OPTS).allowed).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(OPTS.windowMs + 1);

    const after = checkRateLimit(key, OPTS);
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(2);
  });

  test("different keys are tracked independently", () => {
    const keyA = uniqueKey("a");
    const keyB = uniqueKey("b");

    // Exhaust keyA
    checkRateLimit(keyA, OPTS);
    checkRateLimit(keyA, OPTS);
    checkRateLimit(keyA, OPTS);
    expect(checkRateLimit(keyA, OPTS).allowed).toBe(false);

    // keyB is unaffected
    expect(checkRateLimit(keyB, OPTS).allowed).toBe(true);
    expect(checkRateLimit(keyB, OPTS).remaining).toBe(1);
  });

  test("resetAt is set to now + windowMs on first request", () => {
    const now = Date.now();
    const result = checkRateLimit(uniqueKey(), OPTS);
    expect(result.resetAt).toBe(now + OPTS.windowMs);
  });
});
