// ⚠️ SERVER-ONLY: shared profile-update orchestration.
//
// One transaction dance for both users and pages: update the per-kind profile
// mapper (inside the tx) → cascade visibility to all descendants → apply element
// operations → refetch. Used by PUT /api/me/user and PUT /api/pages/[pageId] so
// the visibility cascade rules live in exactly one place.

import type { Visibility } from "@prisma/client";
import { prisma } from "./prisma";
import { updateUserProfile, personalProfileFields } from "./user";
import { updatePageProfile, publicPageFields } from "./page";
import { processElementsPayload } from "./profile-element";
import { syncDescendantVisibility } from "./visibility";
import { validateProfileData, validatePageUpdateData } from "@/lib/validations";
import type { SavePayload } from "@/lib/types/inline-edit";

type ProfileKind = "USER" | "PAGE";

/**
 * Update a user or page profile, cascading any visibility change to all
 * descendant posts/events, and apply element operations — all in one
 * transaction. Returns the refetched profile (kind-specific select).
 */
export async function updateProfileWithCascade(
  kind: ProfileKind,
  id: string,
  fields: Record<string, unknown>,
  elements?: SavePayload["elements"],
) {
  const newVisibility = (fields as { visibility?: Visibility }).visibility;

  return prisma.$transaction(async (tx) => {
    if (kind === "USER") {
      await updateUserProfile(id, fields as Parameters<typeof updateUserProfile>[1], tx);
    } else {
      await updatePageProfile(id, fields as Parameters<typeof updatePageProfile>[1], tx);
    }

    if (newVisibility !== undefined) {
      await syncDescendantVisibility(kind, id, newVisibility, tx);
    }

    // Element ops run on the global client (pre-existing); wrapped by this tx.
    if (elements) {
      await processElementsPayload(kind === "USER" ? { userId: id } : { pageId: id }, elements);
    }

    return kind === "USER"
      ? tx.user.findUnique({ where: { id }, select: personalProfileFields })
      : tx.page.findUnique({ where: { id }, select: publicPageFields });
  });
}

// ─── Shared /api/me/* save executor ──────────────────────────────────────────
//
// `PUT /api/me/user` and `PUT /api/me/page` differ only in how they resolve the
// target id + permission (kept in each route). Everything after that — field
// whitelisting, validation, the visibility cascade, element ops — is identical
// per kind and lives here so the two routes can't drift (and so a page can't
// silently drop visibility the way the old hand-rolled page route did).

type FieldMap = Record<string, unknown>;

/** Whitelist only the keys each kind is allowed to write. updatePageProfile
 *  copies every provided key, so this is also the mass-assignment guard.
 *  Exported for unit testing. */
export function pickProfileFields(kind: ProfileKind, fields: FieldMap): FieldMap {
  const keys =
    kind === "USER"
      ? ["firstName", "middleName", "lastName", "displayName", "headline", "bio",
         "interests", "location", "visibility", "avatarImageId", "aboutContent"]
      : ["name", "headline", "bio", "interests", "location", "addressLine1",
         "addressLine2", "city", "state", "zip", "category", "avatarImageId", "visibility"];
  const picked: FieldMap = {};
  for (const k of keys) {
    if (fields[k] !== undefined) picked[k] = fields[k];
  }
  return picked;
}

/** Validate a whitelisted field set by kind. Returns an error string or null.
 *  Exported for unit testing. */
export function validateProfileFields(kind: ProfileKind, fields: FieldMap): string | null {
  if (kind === "USER") {
    const { displayName, headline, bio, interests, location, visibility,
      firstName, middleName, lastName, aboutContent } = fields as Record<string, never>;
    const validation = validateProfileData({ displayName, headline, bio, interests, location, visibility });
    if (!validation.valid) return validation.error || "Invalid profile data";
    for (const [name, value] of Object.entries({ firstName, middleName, lastName })) {
      if (value !== undefined && (value as string).length > 100) {
        return `${name} must be 100 characters or fewer`;
      }
    }
    if (aboutContent !== undefined && aboutContent !== null && (aboutContent as string).length > 50000) {
      return "aboutContent must be 50,000 characters or fewer";
    }
    return null;
  }

  const { name } = fields as { name?: unknown };
  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) return "Page name is required";
    if (name.length > 100) return "Page name must be 100 characters or fewer";
  }
  const validation = validatePageUpdateData(fields as Parameters<typeof validatePageUpdateData>[0]);
  if (!validation.valid) return validation.error || "Invalid page data";
  return null;
}

export type SaveMyProfileResult =
  | { ok: true; profile: unknown }
  | { ok: false; error: string };

/**
 * Validate + persist a `SavePayload` for the current user's own profile or
 * active page. Callers (the two `/api/me/*` routes) own auth + id resolution;
 * this owns the whitelist, validation, and the cascading write.
 */
export async function saveMyProfile(
  kind: ProfileKind,
  id: string,
  body: SavePayload,
): Promise<SaveMyProfileResult> {
  const { fields = {}, elements } = body;
  const picked = pickProfileFields(kind, fields);

  const error = validateProfileFields(kind, picked);
  if (error) return { ok: false, error };

  const profile = await updateProfileWithCascade(kind, id, picked, elements);
  return { ok: true, profile };
}
