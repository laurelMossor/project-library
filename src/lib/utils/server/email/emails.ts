// ⚠️ SERVER-ONLY
//
// Typed, intent-named senders for each transactional email. Features call these
// (sendVerificationEmail / sendPasswordResetEmail) rather than touching
// templates or sendEmail directly. Each takes a fully-built absolute action URL
// (callers build it from routes.ts + absoluteUrl()).

import { sendEmail, type SendEmailResult } from "./send";
import { VerifyEmail } from "./templates/VerifyEmail";
import { PasswordReset } from "./templates/PasswordReset";
import { NotificationEmail, type NotificationEmailProps } from "./templates/NotificationEmail";

export function sendVerificationEmail(to: string, verifyUrl: string): Promise<SendEmailResult> {
	return sendEmail({
		to,
		subject: "Confirm your email — The Project Library",
		react: VerifyEmail({ url: verifyUrl }),
	});
}

export function sendPasswordResetEmail(to: string, resetUrl: string): Promise<SendEmailResult> {
	return sendEmail({
		to,
		subject: "Reset your password — The Project Library",
		react: PasswordReset({ url: resetUrl }),
	});
}

/** Subject from the coalesced content: the single line verbatim, else a count. */
function notificationSubject(props: NotificationEmailProps): string {
	const rows = props.sections.flatMap((s) => s.rows);
	if (rows.length === 1) return rows[0].text;
	return `${rows.length} new notifications — The Project Library`;
}

/** The grouped activity/message notification email (built + sent by the flush). */
export function sendNotificationEmail(to: string, props: NotificationEmailProps): Promise<SendEmailResult> {
	return sendEmail({ to, subject: notificationSubject(props), react: NotificationEmail(props) });
}
