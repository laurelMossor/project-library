import { LetterEmail } from "./LetterEmail";
import { formatRole } from "@/lib/const/roles";
import { articleFor } from "@/lib/utils/notification-text";

export interface PageInviteEmailProps {
	/** Who sent it (display name, else handle). */
	inviterName: string;
	pageName: string;
	role: string;
	/** The inviter's optional note — plain text, rendered escaped and quoted. */
	note?: string | null;
	/** Absolute /signup?invite=… URL. */
	url: string;
	expiresInDays: number;
}

export function pageInviteSubject(inviterName: string, pageName: string): string {
	return `${inviterName} invited you to ${pageName} on The Project Library`;
}

// Our sentence always comes first so the inviter's note can't pass itself off as the site speaking.
export function PageInviteEmail({ inviterName, pageName, role, note, url, expiresInDays }: PageInviteEmailProps) {
	const roleLabel = formatRole(role);
	return (
		<LetterEmail
			preview={`${inviterName} invited you to join ${pageName}`}
			paragraphs={[
				`Hi! ${inviterName} invited you to join ${pageName} on The Project Library as ${articleFor(roleLabel)} ${roleLabel}.`,
				"The Project Library is a small, intentional home for the things people are making, grounded in creativity, mutuality, and lifelong learning. Once you've made an account, the invitation will be waiting in your notifications.",
			]}
			quote={note ? { attribution: `${inviterName} wrote:`, text: note } : undefined}
			url={url}
			expiryNote={`This link is tied to your email address and expires in ${expiresInDays} days.`}
		/>
	);
}
