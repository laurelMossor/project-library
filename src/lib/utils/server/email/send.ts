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
	// Always ship a plain-text part next to the HTML. Resend renders only HTML from `react`,
	// and a text alternative reads as ordinary mail to inbox classifiers (Gmail tabs).
	const text = await render(react, { plainText: true });

	if (!resend) {
		logDevEmail(to, subject, text);
		return { ok: true };
	}

	try {
		const { error } = await resend.emails.send({
			from: getFromAddress(),
			to,
			subject,
			react,
			text,
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

/**
 * Send several distinct emails in one provider call (Resend's batch API, up to 100), so a
 * burst — e.g. a page admin's email invites — stays under the per-second rate limit.
 * All-or-nothing at the provider: one result for the whole batch.
 */
export async function sendEmailBatch(emails: SendEmailArgs[]): Promise<SendEmailResult> {
	if (emails.length === 0) return { ok: true };
	const resend = getResendClient();
	const rendered = await Promise.all(
		emails.map(async (e) => ({ ...e, text: await render(e.react, { plainText: true }) })),
	);

	if (!resend) {
		for (const e of rendered) logDevEmail(e.to, e.subject, e.text);
		return { ok: true };
	}

	const from = getFromAddress();
	try {
		const { error } = await resend.batch.send(
			rendered.map(({ to, subject, react, text }) => ({ from, to, subject, react, text })),
		);
		if (error) {
			console.error("sendEmailBatch: Resend returned an error", error);
			logAction("email.send_failed", undefined, { count: emails.length, error: error.message });
			return { ok: false, error: error.message };
		}
		return { ok: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error("sendEmailBatch: unexpected failure", err);
		logAction("email.send_failed", undefined, { count: emails.length, error: message });
		return { ok: false, error: message };
	}
}

function logDevEmail(to: string, subject: string, text: string) {
	console.log(
		`\n📧 [email:dev] No RESEND_API_KEY — not sending. Would send:\n` +
			`   To:      ${to}\n` +
			`   Subject: ${subject}\n` +
			`   ----\n${text}\n   ----\n`
	);
}
