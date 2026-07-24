// ⚠️ SERVER-ONLY: shared profile-update orchestration.
//
// One transaction dance for both users and pages: update the per-kind profile
// mapper (inside the tx) → cascade visibility to all descendants → apply element
// operations → refetch. Used by PUT /api/me/user and PUT /api/pages/[pageId] so
// the visibility cascade rules live in exactly one place.

import { ProfileVisibility, ContentVisibility } from "@prisma/client";
import { prisma } from "./prisma";
import { updateUserProfile, personalProfileFields } from "./user";
import { updatePageProfile, publicPageFields } from "./page";
import { processElementsPayload } from "./profile-element";
import { syncDescendantVisibility } from "./visibility";
import { autoApprovePendingOnUnlock } from "./requests";
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
  // The two profile fields are independent: a contentVisibility change cascades to
  // descendants; a profileVisibility unlock materializes pending requests. Neither
  // touches the other.
  const nextProfileVis = (fields as { profileVisibility?: ProfileVisibility }).profileVisibility;
  const nextContentVis = (fields as { contentVisibility?: ContentVisibility }).contentVisibility;

  return prisma.$transaction(async (tx) => {
    if (kind === "USER") {
      await updateUserProfile(id, fields as Parameters<typeof updateUserProfile>[1], tx);
    } else {
      await updatePageProfile(id, fields as Parameters<typeof updatePageProfile>[1], tx);
    }

    if (nextContentVis !== undefined) {
      await syncDescendantVisibility(kind, id, nextContentVis, tx);
    }
    if (nextProfileVis !== undefined && nextProfileVis !== ProfileVisibility.PRIVATE) {
      await autoApprovePendingOnUnlock({ type: kind, id }, tx);
    }

    // Element ops run on this tx so a rollback undoes them alongside the profile/visibility writes.
    if (elements) {
      await processElementsPayload(kind === "USER" ? { userId: id } : { pageId: id }, elements, tx);
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
         "interests", "location", "profileVisibility", "contentVisibility", "avatarImageId", "aboutContent"]
      : ["name", "headline", "bio", "interests", "location", "addressLine1",
         "addressLine2", "city", "state", "zip", "category", "avatarImageId", "profileVisibility", "contentVisibility"];
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
    const { displayName, headline, bio, interests, location, profileVisibility, contentVisibility,
      firstName, middleName, lastName, aboutContent } = fields as Record<string, never>;
    const validation = validateProfileData({ displayName, headline, bio, interests, location, profileVisibility, contentVisibility });
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
  | { ok: false; error: string; forbidden?: boolean };

/** The profile-wide visibility defaults — changing either is ADMIN-only on a page. */
const VISIBILITY_FIELDS = ["profileVisibility", "contentVisibility"] as const;

/**
 * Validate + persist a `SavePayload` for the current user's own profile or
 * active page. Callers (the two `/api/me/*` routes) own auth + id resolution;
 * this owns the whitelist, validation, and the cascading write.
 *
 * `opts.allowVisibilityChange` gates the visibility fields independently of the
 * rest of the profile edit: a page EDITOR may edit content/bio (canPostAsPage) but
 * only an ADMIN (canManagePage) may change the page's privacy. A user editing their
 * own profile is always allowed (self), so callers default this to true.
 */
export async function saveMyProfile(
  kind: ProfileKind,
  id: string,
  body: SavePayload,
  opts: { allowVisibilityChange?: boolean } = {},
): Promise<SaveMyProfileResult> {
  const { allowVisibilityChange = true } = opts;
  const { fields = {}, elements } = body;
  const picked = pickProfileFields(kind, fields);

  if (!allowVisibilityChange && VISIBILITY_FIELDS.some((k) => picked[k] !== undefined)) {
    // `forbidden` lets the route map this to 403 without matching on the message prose.
    return { ok: false, error: "Only an admin can change this page's visibility.", forbidden: true };
  }

  const error = validateProfileFields(kind, picked);
  if (error) return { ok: false, error };

  // Guard: a PRIVATE profile can't have LISTED content as its profile-wide default — the one
  // incoherent pair (a locked profile whose entire output floods public feeds). Merge the
  // incoming change with the STORED state so a partial save (only one field dirty) can't slip
  // the combo past the check. This constrains only the profile-wide default; a future per-item
  // override (e.g. a single "For Sale" post LISTED while the profile default stays PRIVATE) lives
  // on the post/event's own field and is intentionally NOT gated here.
  const guardError = await assertProfileContentPairing(kind, id, picked);
  if (guardError) return { ok: false, error: guardError };

  const profile = await updateProfileWithCascade(kind, id, picked, elements);
  return { ok: true, profile };
}

/** Reject the PRIVATE-profile + LISTED-content default combination, evaluated on the merged
 *  (stored + incoming) state. Returns an error string or null. Exported for unit testing. */
export async function assertProfileContentPairing(
  kind: ProfileKind,
  id: string,
  picked: FieldMap,
): Promise<string | null> {
  const incomingProfileVis = picked.profileVisibility as ProfileVisibility | undefined;
  const incomingContentVis = picked.contentVisibility as ContentVisibility | undefined;
  // Nothing visibility-related changed → nothing to check.
  if (incomingProfileVis === undefined && incomingContentVis === undefined) return null;

  const current =
    kind === "USER"
      ? await prisma.user.findUnique({ where: { id }, select: { profileVisibility: true, contentVisibility: true } })
      : await prisma.page.findUnique({ where: { id }, select: { profileVisibility: true, contentVisibility: true } });

  const mergedProfileVis = incomingProfileVis ?? current?.profileVisibility;
  const mergedContentVis = incomingContentVis ?? current?.contentVisibility;
  if (mergedProfileVis === ProfileVisibility.PRIVATE && mergedContentVis === ContentVisibility.LISTED) {
    return "A private profile can't have listed content — choose Unlisted or Private for your posts.";
  }
  return null;
}
