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
