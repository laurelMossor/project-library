// ⚠️ SERVER-ONLY: shared profile-update orchestration.
//
// One transaction dance for both users and pages: update the per-kind profile
// mapper (inside the tx) → cascade visibility to all descendants → apply element
// operations → refetch. Used by the profile Server Actions (`updateProfile`) so
// the visibility cascade rules live in exactly one place.

import { ProfileVisibility, ContentVisibility, MembershipPolicy } from "@prisma/client";
import { prisma } from "./prisma";
import { updateUserProfile, personalProfileFields } from "./user";
import { updatePageProfile, publicPageFields } from "./page";
import { processElementsPayload } from "./profile-element";
import { syncDescendantVisibility } from "./visibility";
import { autoApprovePendingOnUnlock } from "./requests";
import { validateProfileData, validatePageUpdateData } from "@/lib/validations";
import { avatarAssignmentError } from "./image-attachment";
import { canManagePage, canPostAsPage } from "./permission";
import { setPageHandle, setUserHandle } from "./handle";
import { DomainError } from "./domain-error";
import type { SavePayload } from "@/lib/types/inline-edit";
import type { ProfileTarget } from "@/lib/types/profile";

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

// ─── Shared save executor ────────────────────────────────────────────────────
//
// A user and a page differ only in how the target id + permission resolve
// (`resolveProfileTarget`). Everything after that — field whitelisting,
// validation, the visibility cascade, element ops — is identical per kind and
// lives here so the two can't drift.

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
         "addressLine2", "city", "state", "zip", "category", "avatarImageId",
         "profileVisibility", "contentVisibility", "membershipPolicy", "allowMemberPosts"];
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

/**
 * Page settings only an ADMIN may change: privacy, who can be a member, and
 * whether members can post to the page. An EDITOR may edit the rest of the profile.
 */
const MANAGE_FIELDS = ["profileVisibility", "contentVisibility", "membershipPolicy", "allowMemberPosts"] as const;

/**
 * Validate + persist a `SavePayload` for the current user's own profile or
 * active page. Callers (`updateProfile`) own auth + id resolution;
 * this owns the whitelist, validation, and the cascading write.
 *
 * `opts.allowManageChange` gates the manage-only fields independently of the
 * rest of the profile edit: a page EDITOR may edit content/bio (canPostAsPage) but
 * only an ADMIN (canManagePage) may change privacy or membership settings. A user
 * editing their own profile is always allowed (self), so callers default this to true.
 */
export async function saveMyProfile(
  kind: ProfileKind,
  id: string,
  body: SavePayload,
  opts: { allowManageChange?: boolean; actorUserId?: string } = {},
): Promise<SaveMyProfileResult> {
  const { allowManageChange = true, actorUserId } = opts;
  const { fields = {}, elements } = body;
  const picked = pickProfileFields(kind, fields);

  if (!allowManageChange && MANAGE_FIELDS.some((k) => picked[k] !== undefined)) {
    // `forbidden` lets the caller map this to a forbidden refusal without matching on the message prose.
    return { ok: false, error: "Only an admin can change this page's settings.", forbidden: true };
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

  if (typeof picked.avatarImageId === "string") {
    if (!actorUserId) return { ok: false, error: "That photo can't be used as a profile picture." };
    const current = kind === "USER"
      ? await prisma.user.findUnique({ where: { id }, select: { avatarImageId: true } })
      : await prisma.page.findUnique({ where: { id }, select: { avatarImageId: true } });
    const avatarError = await avatarAssignmentError(
      actorUserId,
      picked.avatarImageId,
      current?.avatarImageId ?? null,
    );
    if (avatarError) return { ok: false, error: avatarError };
  }

  if (kind === "PAGE") {
    const membershipError = await normalizeMembershipFields(id, picked);
    if (membershipError) return { ok: false, error: membershipError };
  }

  const profile = await updateProfileWithCascade(kind, id, picked, elements);
  return { ok: true, profile };
}

/**
 * Resolve a client-supplied profile target to the kind + id the caller may write, and whether
 * they may also change a page's manage-only settings. A user edits only their own profile. A
 * page needs an acting role (ADMIN/EDITOR); no row and no such page are the same refusal.
 * Shared by the profile save and the handle change so the two can't disagree on who may edit.
 */
export async function resolveProfileTarget(
  actorUserId: string,
  target: ProfileTarget | undefined,
): Promise<{ kind: ProfileKind; id: string; canManage: boolean }> {
  if (target?.type === "user") return { kind: "USER", id: actorUserId, canManage: true };
  if (target?.type !== "page" || typeof target.id !== "string" || !target.id) {
    throw new DomainError("Invalid profile");
  }
  if (!(await canPostAsPage(actorUserId, target.id))) {
    throw new DomainError("You don't have permission to manage this page", "forbidden");
  }
  return { kind: "PAGE", id: target.id, canManage: await canManagePage(actorUserId, target.id) };
}

/**
 * Save the signed-in user's profile, or a page they may act as. Privacy and membership
 * settings stay ADMIN-only even though an EDITOR may edit the rest. Returns the refetched
 * profile; any refusal is a DomainError.
 */
export async function updateProfile(
  actorUserId: string,
  target: ProfileTarget | undefined,
  payload: SavePayload | undefined,
): Promise<Record<string, unknown>> {
  if (!payload || typeof payload !== "object" || typeof payload.fields !== "object" || payload.fields === null) {
    throw new DomainError("Invalid profile update");
  }
  const { kind, id, canManage } = await resolveProfileTarget(actorUserId, target);
  const result = await saveMyProfile(kind, id, payload, { allowManageChange: canManage, actorUserId });
  if (!result.ok) throw new DomainError(result.error, result.forbidden ? "forbidden" : "invalid");
  return result.profile as Record<string, unknown>;
}

/**
 * Change the handle of the signed-in user, or of a page they may act as. Kept off the generic
 * save because a handle change also moves the cross-entity `Handle` row. Returns the saved handle.
 */
export async function changeProfileHandle(
  actorUserId: string,
  target: ProfileTarget | undefined,
  rawHandle: unknown,
): Promise<string> {
  if (typeof rawHandle !== "string") throw new DomainError("Handle is required");
  const { kind, id } = await resolveProfileTarget(actorUserId, target);
  const result = kind === "USER" ? await setUserHandle(id, rawHandle) : await setPageHandle(id, rawHandle);
  if (!result.ok) throw new DomainError(result.error);
  return result.handle;
}

const PRIVATE_LISTED =
  "A private profile can't have listed content — choose Unlisted or Private for your posts.";

/** The one PRIVATE + LISTED rejection. Callers decide what "omitted" means: a save merges
 *  with the stored profile first; page create passes the LISTED default `createPage` would store. */
export function profileContentPairingError(
  profileVisibility: ProfileVisibility | null | undefined,
  contentVisibility: ContentVisibility | null | undefined,
): string | null {
  if (profileVisibility === ProfileVisibility.PRIVATE && contentVisibility === ContentVisibility.LISTED) {
    return PRIVATE_LISTED;
  }
  return null;
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
  return profileContentPairingError(mergedProfileVis, mergedContentVis);
}

/**
 * Membership settings, evaluated on the merged (stored + incoming) policy.
 * OPEN is rejected by validation before this runs. Saving CLOSED forces member
 * posts off — the toggle is meaningless while the page has no members.
 * Mutates `picked`. Returns an error string or null.
 */
export async function normalizeMembershipFields(id: string, picked: FieldMap): Promise<string | null> {
  if (picked.membershipPolicy === undefined && picked.allowMemberPosts === undefined) return null;

  const current = await prisma.page.findUnique({
    where: { id },
    select: { membershipPolicy: true },
  });
  const merged = (picked.membershipPolicy as MembershipPolicy | undefined) ?? current?.membershipPolicy;
  if (merged === MembershipPolicy.CLOSED) {
    picked.allowMemberPosts = false;
  }
  return null;
}
