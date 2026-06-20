// ⚠️ SERVER-ONLY
//
// The single choke point for all outbound email. Every feature that sends mail
// goes through sendEmail() — no one calls the Resend client directly. This is
// the swappable seam: change the provider here and nothing upstream changes.

import { render } from "@react-email/components";
import type { ReactElement } from "react";
import { getFromAddress, getResendClient } from "./client";
import { logAction } from "@/lib/utils/server/log";

export interface SendEmailArgs {
	to: string;
	subject: string;
	react: ReactElement;
}

export type SendEmailResult = { ok: true } | { ok: false; error: string };

/**
 * Send a transactional email.
 *
 * Dev/test fallback: when RESEND_API_KEY is unset, the email is rendered to
 * plain text and logged to the console instead of sent — mirroring the
 * Supabase-optional-in-dev upload pattern, so local runs and the test suite
 * need no credentials. The rendered text includes any action link, so you can
 * complete verify/reset flows locally straight from the terminal.
 */
export async function sendEmail({ to, subject, react }: SendEmailArgs): Promise<SendEmailResult> {
	const resend = getResendClient();

	if (!resend) {
		const text = await render(react, { plainText: true });
		console.log(
			`\n📧 [email:dev] No RESEND_API_KEY — not sending. Would send:\n` +
				`   To:      ${to}\n` +
				`   Subject: ${subject}\n` +
				`   ----\n${text}\n   ----\n`
		);
		return { ok: true };
	}

	try {
		const { error } = await resend.emails.send({
			from: getFromAddress(),
			to,
			subject,
			react,
		});

		if (error) {
			// Provider rejected the send (bad address, domain not verified, etc.)
			console.error("sendEmail: Resend returned an error", error);
			logAction("email.send_failed", undefined, { to, subject, error: error.message });
			// TODO: route to richer alerting (e.g. Sentry) once observability lands.
			return { ok: false, error: error.message };
		}

		return { ok: true };
	} catch (err) {
		// Network/transport failure or unexpected throw.
		const message = err instanceof Error ? err.message : String(err);
		console.error("sendEmail: unexpected failure", err);
		logAction("email.send_failed", undefined, { to, subject, error: message });
		// TODO: route to richer alerting (e.g. Sentry) once observability lands.
		return { ok: false, error: message };
	}
}
