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
import { FEATURES } from "./features";

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

/**
 * Roles an admin may assign from the membership UI, gated by the membership flag.
 * Flag ON → ADMIN/EDITOR/MEMBER; OFF (beta) → ADMIN/EDITOR only, so MEMBER can't be
 * granted while self-service membership is hidden. The one flag-driven role policy —
 * consumed by both the client `RoleSelector` and the server members-route validation.
 */
export function assignableRoles(): readonly PermissionRole[] {
	return FEATURES.SELF_SERVICE_MEMBERSHIP ? ALL_ROLES : ACTING_ROLES;
}
