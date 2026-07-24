// ⚠️ SERVER-ONLY: Session utility functions
import { auth } from "@/lib/auth";
import { canPostAsPage } from "./permission";

export type SessionContext = {
  userId: string;
  activePageId: string | null;
};

/** Get the current authenticated user's ID from session */
export async function getSessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Get the active page ID from session */
export async function getActivePageId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.activePageId ?? null;
}

/**
 * Get full session context. The NextAuth `session` callback already verifies the
 * user still exists AND that the token epoch is current (rejecting stale sessions
 * after a password reset, re-seed, or deletion), so a session with a `user.id`
 * here is trustworthy — no extra DB round-trip needed.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    userId: session.user.id,
    activePageId: session.user.activePageId ?? null,
  };
}

/** Validate that a user can set a specific page as active */
export async function canSetActivePage(userId: string, pageId: string): Promise<boolean> {
  return canPostAsPage(userId, pageId);
}

/** Check if the current session can edit a user profile */
export type ProfileEditCheck = {
  canEdit: boolean;
  reason?: "not_authenticated" | "not_owner";
};

export async function canEditUserProfile(userId: string): Promise<ProfileEditCheck> {
  const ctx = await getSessionContext();
  if (!ctx) return { canEdit: false, reason: "not_authenticated" };
  if (ctx.userId !== userId) return { canEdit: false, reason: "not_owner" };
  return { canEdit: true };
}

/** Check if the current session can edit a page profile */
export async function canEditPageProfile(pageId: string): Promise<ProfileEditCheck> {
  const ctx = await getSessionContext();
  if (!ctx) return { canEdit: false, reason: "not_authenticated" };
  // "Edit the page" is the act-as-page tier (ADMIN/EDITOR), not ADMIN-only management.
  const canEdit = await canPostAsPage(ctx.userId, pageId);
  if (!canEdit) return { canEdit: false, reason: "not_owner" };
  return { canEdit: true };
}
