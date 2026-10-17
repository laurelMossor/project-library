"use client";

import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { isCardPage } from "@/lib/types/card";

/**
 * Is the profile shown the one the viewer is acting as? A user viewing themselves while acting as a
 * page still counts as "own".
 */
export function useIsOwnProfile(entityId: string, entityType: "user" | "page"): boolean {
	const { activeEntity, currentUser } = useActiveProfile();
	if (!activeEntity) return false;
	if (entityType === "page") return isCardPage(activeEntity) && activeEntity.id === entityId;
	if (!isCardPage(activeEntity) && activeEntity.id === entityId) return true;
	return currentUser?.id === entityId;
}
