import { LetterEmail } from "./LetterEmail";

// Beta invitation email. Unlike VerifyEmail / PasswordReset, this one is sent
// only by scripts/send-signup-invites.ts, which cannot import emails.ts (that
// pulls in the server-only Resend client). So the subject lives here with the
// copy rather than in emails.ts.
export const INVITE_EMAIL_SUBJECT = "You're invited to The Project Library";

interface InviteEmailProps {
	/** Absolute /signup?invite=… URL. */
	url: string;
	/** Days until the invite expires — pass SIGNUP_INVITE_TTL_DAYS. */
	expiresInDays: number;
}

export function InviteEmail({ url, expiresInDays }: InviteEmailProps) {
	return (
		<LetterEmail
			preview="An invitation to The Project Library"
			paragraphs={[
				"Hi! You're invited to The Project Library.",
				"It's in the early beginnings of becoming a small, intentional home for the things people are making, grounded in creativity, mutuality, and lifelong learning.",
			]}
			url={url}
			expiryNote={`This invitation is tied to your email address and expires in ${expiresInDays} days. If it runs out, reach out for another one.`}
			signoff="Welcome. Love, Laurel"
		/>
	);
}
