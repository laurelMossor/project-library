// ⚠️ SERVER-ONLY: invite-by-email, end to end — create the invites, then mail the signup links.

import { after } from "next/server";
import { prisma } from "./prisma";
import { inviteMembersByEmail, parseRole } from "./requests";
import { SIGNUP_INVITE_TTL_DAYS } from "./signup-invite";
import { sendPageInviteEmails } from "./email/emails";
import { absoluteUrl } from "./url";
import { logAction } from "./log";
import { getUserDisplayName } from "@/lib/types/user";
import { SIGNUP_WITH_INVITE } from "@/lib/const/routes";

export type EmailInviteOutcome = {
  /** Addresses that became an invite (in-app or signup email). */
  sent: number;
  /** Addresses that already hold a role on the page. Nothing was created for them. */
  alreadyMembers: string[];
};

/**
 * Page ADMIN: invite people to a role by email. Addresses with an account get the normal in-app
 * invite; the rest get a signup link and their invite waits for them. The outcome names addresses
 * that already have a role, and says nothing about which other addresses had accounts.
 */
export async function inviteByEmail(
  actorId: string,
  pageId: string,
  input: { emails: unknown; role: unknown; note?: unknown },
): Promise<EmailInviteOutcome> {
  const result = await inviteMembersByEmail(actorId, pageId, input);
  const role = parseRole(input.role);

  if (result.signupInvites.length > 0) {
    const inviter = await prisma.user.findUnique({
      where: { id: actorId },
      select: { displayName: true, firstName: true, lastName: true, handle: true },
    });
    const inviterName = inviter ? getUserDisplayName(inviter) : "Someone";
    const note = typeof input.note === "string" ? input.note.trim() || null : null;
    const { page, signupInvites } = result;
    // Send after responding: the invites already exist, so a provider hiccup must not fail the request.
    after(async () => {
      const sent = await sendPageInviteEmails(
        signupInvites.map(({ email, rawToken }) => ({
          to: email,
          inviterName,
          pageName: page.name,
          role,
          note,
          url: absoluteUrl(SIGNUP_WITH_INVITE(rawToken)),
          expiresInDays: SIGNUP_INVITE_TTL_DAYS,
        })),
      );
      if (!sent.ok) {
        logAction("page_invite.email_failed", actorId, { pageId, count: signupInvites.length, error: sent.error });
      }
    });
  }

  logAction("page_invite.email_sent", actorId, {
    pageId,
    count: result.sent,
    alreadyMembers: result.alreadyMembers.length,
    role,
  });
  return { sent: result.sent, alreadyMembers: result.alreadyMembers };
}
