import { ActionEmail } from "./ActionEmail";

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
		<ActionEmail
			preview="An early invitation to The Project Library"
			title="You're invited!"
			intro="The Project Library is in the early beginnings of building a small, intentional home for the things people are making: grounded in creativity, mutuality, and lifelong learning. Welcome. Love, Laurel"
			buttonLabel="Sign up now"
			url={url}
			expiryNote={`This invitation is just for you and expires in ${expiresInDays} days.`}
			footnote="Your invite code is tied to this email address. Use it to create your account or reach out for another invitation."
		/>
	);
}
