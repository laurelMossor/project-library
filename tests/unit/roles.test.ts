/**
 * Role vocabulary tests — the shared client-safe role policy (`@/lib/const/roles`).
 *
 * Locks: the role-value sets stay in step with the Prisma enum; the predicates
 * classify correctly; and `assignableRoles()` is flag-driven (MEMBER is only
 * assignable while self-service membership is ON).
 *
 * The membership flag is a compile-time const, so we mock the features module with a
 * getter over a hoisted holder — flipping `flag.on` between tests changes what
 * `assignableRoles()` reads at call time.
 */
import { describe, test, expect, vi } from "vitest";
import { PermissionRole } from "@prisma/client";

const flag = vi.hoisted(() => ({ on: false }));
vi.mock("@/lib/const/features", () => ({
  FEATURES: {
    get SELF_SERVICE_MEMBERSHIP() {
      return flag.on;
    },
  },
}));

import {
  ACTING_ROLES,
  ADMIN_ONLY,
  ALL_ROLES,
  isActingRole,
  isAdminRole,
  assignableRoles,
} from "@/lib/const/roles";

describe("role vocabulary", () => {
  test("every declared role value is a real PermissionRole (no schema drift)", () => {
    const enumValues = new Set<string>(Object.values(PermissionRole));
    for (const r of [...ACTING_ROLES, ...ADMIN_ONLY, ...ALL_ROLES]) {
      expect(enumValues.has(r)).toBe(true);
    }
  });

  test("ALL_ROLES is exhaustive over the enum", () => {
    expect([...ALL_ROLES].sort()).toEqual([...Object.values(PermissionRole)].sort());
  });

  test("isActingRole → ADMIN/EDITOR only", () => {
    expect(isActingRole("ADMIN")).toBe(true);
    expect(isActingRole("EDITOR")).toBe(true);
    expect(isActingRole("MEMBER")).toBe(false);
    expect(isActingRole(null)).toBe(false);
    expect(isActingRole(undefined)).toBe(false);
  });

  test("isAdminRole → ADMIN only", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("EDITOR")).toBe(false);
    expect(isAdminRole("MEMBER")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });
});

describe("assignableRoles (flag-driven)", () => {
  test("flag OFF (beta) → ADMIN/EDITOR only, MEMBER not assignable", () => {
    flag.on = false;
    const roles = assignableRoles();
    expect(roles).toContain("ADMIN");
    expect(roles).toContain("EDITOR");
    expect(roles).not.toContain("MEMBER");
  });

  test("flag ON → all three roles assignable", () => {
    flag.on = true;
    expect([...assignableRoles()].sort()).toEqual(["ADMIN", "EDITOR", "MEMBER"]);
  });
});
