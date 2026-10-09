import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ "x-forwarded-for": "1.2.3.4" })) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/rate-limit", () => ({ isRateLimited: vi.fn(async () => false) }));

import { refresh } from "next/cache";
import { authedAction, publicAction } from "@/lib/utils/server/action";
import { DomainError } from "@/lib/utils/server/domain-error";
import { getSessionContext } from "@/lib/utils/server/session";
import { isRateLimited } from "@/lib/utils/server/rate-limit";

const ctx = { userId: "u1", activePageId: null };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionContext).mockResolvedValue(ctx);
  vi.mocked(isRateLimited).mockResolvedValue(false);
});

describe("authedAction", () => {
  test("signed out → unauthorized, handler never runs", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(null);
    const handler = vi.fn();
    expect(await authedAction(handler)({})).toMatchObject({ ok: false, error: "unauthorized" });
    expect(handler).not.toHaveBeenCalled();
  });

  test("success → data, and the page refreshes", async () => {
    const result = await authedAction(async (c, n: number) => `${c.userId}:${n}`)(2);
    expect(result).toEqual({ ok: true, data: "u1:2" });
    expect(refresh).toHaveBeenCalledOnce();
  });

  test("refresh: false skips the refresh", async () => {
    await authedAction(async () => 1, { refresh: false })(undefined);
    expect(refresh).not.toHaveBeenCalled();
  });

  test("DomainError → its code and user-safe message, no refresh", async () => {
    const action = authedAction(async () => {
      throw new DomainError("Nope", "forbidden");
    });
    expect(await action(undefined)).toEqual({ ok: false, error: "forbidden", message: "Nope" });
    expect(refresh).not.toHaveBeenCalled();
  });

  test("DomainError with refresh still refuses, and re-renders the page", async () => {
    const action = authedAction(async () => {
      throw new DomainError("Gone", "conflict", { refresh: true });
    });
    expect(await action(undefined)).toEqual({ ok: false, error: "conflict", message: "Gone" });
    expect(refresh).toHaveBeenCalledOnce();
  });

  test("unexpected error → generic server error, internals not leaked", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const action = authedAction(async () => {
      throw new Error("db password is hunter2");
    });
    const result = await action(undefined);
    expect(result).toMatchObject({ ok: false, error: "server" });
    expect(JSON.stringify(result)).not.toContain("hunter2");
  });

  test("rate limited → rate_limited, handler never runs", async () => {
    vi.mocked(isRateLimited).mockResolvedValue(true);
    const handler = vi.fn();
    const action = authedAction(handler, { rateLimit: { key: "k", maxRequests: 1, windowMs: 1000 } });
    expect(await action(undefined)).toMatchObject({ ok: false, error: "rate_limited" });
    expect(handler).not.toHaveBeenCalled();
    expect(isRateLimited).toHaveBeenCalledWith(expect.any(Headers), "k", { maxRequests: 1, windowMs: 1000 });
  });
});

describe("publicAction", () => {
  test("runs signed out with a null context", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(null);
    const result = await publicAction(async (c) => c?.userId ?? "anon")(undefined);
    expect(result).toEqual({ ok: true, data: "anon" });
  });
});
