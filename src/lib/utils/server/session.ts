// ⚠️ SERVER-ONLY: Session utility functions
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { prisma } from "./prisma";
import { canPostAsPage } from "./permission";
import { publicUserEmbedFields } from "./user";
import { publicPageEmbedFields } from "./fields";
import type { CardUser, CardPage } from "@/lib/types/card";

export type SessionContext = {
  userId: string;
  activePageId: string | null;
};

export type ActingIdentity = {
  /** The signed-in user, always resolved when authenticated. */
  currentUser: CardUser | null;
  /** The page the user is acting as, or null for personal identity. */
  activePage: CardPage | null;
};

/**
 * Resolve the acting identity (personal user + active page, if any) for the nav.
 *
 * This is the server-side source of truth the root layout hands to
 * `ActiveProfileProvider` as props, so `router.refresh()` re-syncs the nav after a
 * profile/avatar edit — replacing the old client fetch-cache that never invalidated.
 *
 * Uses the lean *embed* selectors (no email/bio/elements): CardUser/CardPage are all
 * the nav needs, and it keeps sensitive profile data off the RSC→client prop boundary.
 * `activePageId` comes from the JWT (client-settable via updateSession), so the page is
 * re-gated with `canPostAsPage` here — matching GET /api/me/page — before it's returned.
 */
export async function getActingIdentity(session: Session | null): Promise<ActingIdentity> {
  const userId = session?.user?.id;
  if (!userId) return { currentUser: null, activePage: null };

  const activePageId = session.user.activePageId ?? null;

  const [currentUser, activePage] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: publicUserEmbedFields }),
    resolveActivePage(userId, activePageId),
  ]);

  return { currentUser, activePage };
}

/** Fetch the active page only if it's set and the user may still act as it. */
async function resolveActivePage(userId: string, activePageId: string | null): Promise<CardPage | null> {
  if (!activePageId) return null;
  if (!(await canPostAsPage(userId, activePageId))) return null;
  return prisma.page.findUnique({ where: { id: activePageId }, select: publicPageEmbedFields });
}

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
