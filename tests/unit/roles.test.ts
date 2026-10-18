/**
 * Role vocabulary. assignableRoles follows the page's membership policy:
 * CLOSED offers ADMIN/EDITOR; any other policy offers all three.
 */
import { describe, test, expect } from "vitest";
import { PermissionRole } from "@prisma/client";
import {
  ACTING_ROLES,
  ADMIN_ONLY,
  ALL_ROLES,
  isActingRole,
  isAdminRole,
  canPostToPage,
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

describe("canPostToPage", () => {
  test("no role → false, even when member posts are allowed", () => {
    expect(canPostToPage(null, true)).toBe(false);
    expect(canPostToPage(undefined, true)).toBe(false);
    expect(canPostToPage("", true)).toBe(false);
  });

  test("acting role is true even when member posts are off", () => {
    expect(canPostToPage("ADMIN", false)).toBe(true);
    expect(canPostToPage("EDITOR", false)).toBe(true);
  });

  test("a member follows the page flag", () => {
    expect(canPostToPage("MEMBER", false)).toBe(false);
    expect(canPostToPage("MEMBER", true)).toBe(true);
  });
});

describe("assignableRoles (policy)", () => {
  test("CLOSED → ADMIN/EDITOR only", () => {
    const roles = assignableRoles("CLOSED");
    expect(roles).toContain("ADMIN");
    expect(roles).toContain("EDITOR");
    expect(roles).not.toContain("MEMBER");
  });

  test("INVITE_ONLY and REQUEST_TO_JOIN → all three", () => {
    expect([...assignableRoles("INVITE_ONLY")].sort()).toEqual(["ADMIN", "EDITOR", "MEMBER"]);
    expect([...assignableRoles("REQUEST_TO_JOIN")].sort()).toEqual(["ADMIN", "EDITOR", "MEMBER"]);
  });
});
