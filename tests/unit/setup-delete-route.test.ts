/**
 * DELETE /api/me/setup deletes only an unfinished account.
 * A finished account is 409 so a second tab cannot delete it from setup.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/utils/server/user", () => ({
  isSetupComplete: vi.fn(),
  deleteAccount: vi.fn(),
  AccountDeleteConflict: class AccountDeleteConflict extends Error {
    constructor() {
      super("The pages that would be deleted have changed. Review the list and try again.");
      this.name = "AccountDeleteConflict";
    }
  },
  SetupAlreadyFinished: class SetupAlreadyFinished extends Error {
    constructor() {
      super("This account is already set up — delete it from Settings.");
      this.name = "SetupAlreadyFinished";
    }
  },
}));
vi.mock("@/lib/utils/server/storage", () => ({ removeStoragePaths: vi.fn() }));

import { DELETE } from "@/app/api/me/setup/route";
import { auth } from "@/lib/auth";
import { AccountDeleteConflict, deleteAccount, isSetupComplete, SetupAlreadyFinished } from "@/lib/utils/server/user";
import { removeStoragePaths } from "@/lib/utils/server/storage";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
});

describe("DELETE /api/me/setup", () => {
  test("anonymous → 401", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await DELETE();
    expect(res.status).toBe(401);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  test("unfinished account → deletes", async () => {
    vi.mocked(isSetupComplete).mockResolvedValue(false);
    vi.mocked(deleteAccount).mockResolvedValue(["avatars/a.png"]);
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(deleteAccount).toHaveBeenCalledWith("u1", [], { onlyIfUnfinished: true });
    expect(removeStoragePaths).toHaveBeenCalledWith(["avatars/a.png"]);
  });

  test("finished account → 409", async () => {
    vi.mocked(isSetupComplete).mockResolvedValue(true);
    const res = await DELETE();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "This account is already set up — delete it from Settings.",
    });
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  test("finished between the check and the lock → 409", async () => {
    vi.mocked(isSetupComplete).mockResolvedValue(false);
    vi.mocked(deleteAccount).mockRejectedValue(new SetupAlreadyFinished());
    const res = await DELETE();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "This account is already set up — delete it from Settings.",
    });
  });

  test("sole-admin conflict → 409 with the conflict message", async () => {
    vi.mocked(isSetupComplete).mockResolvedValue(false);
    vi.mocked(deleteAccount).mockRejectedValue(new AccountDeleteConflict());
    const res = await DELETE();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/have changed/);
  });
});
