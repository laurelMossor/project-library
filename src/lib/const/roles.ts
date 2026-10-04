// Role vocabulary — the single source for permission-role values and the sets /
// predicates that classify them. Pure constants plus a type-only Prisma import
// (erased from client bundles), so client components and server helpers share one
// definition instead of each restating "ADMIN" | "EDITOR" | ... literals.
//
// The `satisfies readonly PermissionRole[]` guards make a schema-side enum rename a
// compile error here, rather than silent drift — validation, not a parallel type.
//
// Server authorization still routes through `permission.ts` helpers; this module only
// owns the role *vocabulary* those helpers (and the client UI) speak. Two tiers:
//   ADMIN        → management: members, roles, privacy, destructive (canManagePage)
//   ADMIN/EDITOR → act as the page: author, message, comment      (canPostAsPage)

import type { PermissionRole } from "@prisma/client";

/** Roles that can act as a page — author content, message, comment. (ADMIN or EDITOR.) */
export const ACTING_ROLES = ["ADMIN", "EDITOR"] as const satisfies readonly PermissionRole[];

/** Management tier — members, roles, privacy, destructive actions. (ADMIN only.) */
export const ADMIN_ONLY = ["ADMIN"] as const satisfies readonly PermissionRole[];

/** Every role, most-privileged first. */
export const ALL_ROLES = ["ADMIN", "EDITOR", "MEMBER"] as const satisfies readonly PermissionRole[];

// Predicates accept a plain string so both server (PermissionRole) and client (role
// strings from the API) can call them; they classify by value and return false otherwise.

/** Can this role act as the page (post / message / comment)? ADMIN or EDITOR. */
export function isActingRole(role: string | null | undefined): boolean {
	return role === "ADMIN" || role === "EDITOR";
}

/** Is this the ADMIN role (full page management)? */
export function isAdminRole(role: string | null | undefined): boolean {
	return role === "ADMIN";
}

/** "ADMIN" → "Admin". Shared by role tags and the pending-invite line. */
export function formatRole(role: string | null | undefined): string {
	if (!role) return "";
	return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

/**
 * Roles an admin may invite, given the page's membership policy.
 * CLOSED → ADMIN/EDITOR only (the page has no members). Any other policy → all three.
 * OPEN is in the enum but the server rejects saving it; if it were stored, MEMBER
 * would be assignable. Consumed by the client RoleSelector and invite validation.
 */
export function assignableRoles(policy: string | null | undefined): readonly PermissionRole[] {
	return policy && policy !== "CLOSED" ? ALL_ROLES : ACTING_ROLES;
}
