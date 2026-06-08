// ⚠️ SERVER-ONLY
//
// Typed, intent-named senders for each transactional email. Features call these
// (sendVerificationEmail / sendPasswordResetEmail) rather than touching
// templates or sendEmail directly. Each takes a fully-built absolute action URL
// (callers build it from routes.ts + absoluteUrl()).

import { sendEmail, type SendEmailResult } from "./send";
import { VerifyEmail } from "./templates/VerifyEmail";
import { PasswordReset } from "./templates/PasswordReset";

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
