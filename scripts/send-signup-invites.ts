/**
 * Interactive bulk signup-invite sender — PRODUCTION.
 *
 * Usage: npm run invite
 *
 * Prompts for one or more emails, shows a numbered confirmation that names the
 * target database host and the From address, then — only after you type y —
 * creates one email-bound SignupInvite per address and emails the invite link.
 *
 * Targets prod on purpose: the invite row has to exist in the Supabase DB where
 * people actually sign up, and delivery needs the real Resend key. Loads
 * .env.production. Nothing is written or sent before the y/N confirm.
 *
 * WHY THIS DOESN'T USE sendEmail():
 * src/lib/utils/server/email/send.ts imports client.ts, which starts with
 * `import "server-only"` and therefore throws in a plain Node process. Running
 * tsx with --conditions=react-server neutralizes that import but then breaks
 * @react-email/render ("react-dom/server is not supported in React Server
 * Components"). So this script builds its own Resend client and calls
 * resend.emails.send({ react }) directly — Resend renders the template with the
 * same @react-email/render the app uses. The template is still shared; only the
 * transport call is duplicated.
 *
 * Sibling: scripts/create-signup-invite.ts (`npm run invite:create`) creates ONE
 * invite and prints the link without sending — the dev/local path. This one is
 * additive; both call createSignupInvite().
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";

// CRITICAL: load env BEFORE importing any app code — src/lib/utils/server/prisma.ts
// throws at module evaluation when DATABASE_URL is unset, so every app import
// below is a dynamic await import() inside main(), after this runs.
// This script always targets prod, so .env.production is loaded last with override.
// .env.local is deliberately skipped (its job is overriding toward local).
const root = process.cwd();
for (const name of [".env", ".env.production"] as const) {
	const p = resolve(root, name);
	if (existsSync(p)) config({ path: p, override: name === ".env.production" });
}

// Resend free tier is ~2 req/sec — stay under it when sending a batch.
const SEND_DELAY_MS = 600;

function fail(message: string): never {
	console.error(`\n✗ ${message}\n`);
	process.exit(1);
}

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/** Host only — never the credentials embedded in DATABASE_URL. */
function databaseHost(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return "(unparseable DATABASE_URL)";
	}
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
	// ── Guards ───────────────────────────────────────────────────────────
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) fail("DATABASE_URL is not set. Check .env.production.");
	if (!process.env.RESEND_API_KEY) {
		// Hard fail, not a console fallback: this writes real invite rows to prod.
		// Silently "sending" to the console would leave invites nobody received.
		fail(
			"RESEND_API_KEY is not set. Refusing to create prod invites that can't be delivered.\n" +
				"  For a link-only invite, use: npm run invite:create -- someone@example.com"
		);
	}

	const { getAppBaseUrl, absoluteUrl } = await import("@/lib/utils/server/url");
	const baseUrl = getAppBaseUrl();
	const baseHost = new URL(baseUrl).hostname;
	if (baseHost === "localhost" || baseHost === "127.0.0.1") {
		fail(
			`Link base URL resolves to ${baseUrl} — invitees would get a localhost link.\n` +
				`  Set APP_BASE_URL="https://www.theprojectlibrary.com" in .env.production.`
		);
	}

	const { normalizeEmail, validateEmail } = await import("@/lib/validations");
	const from = process.env.EMAIL_FROM || "The Project Library <onboarding@resend.dev>";

	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		// ── Prompt + parse ─────────────────────────────────────────────────
		const answer = await rl.question("\nEmail(s) to invite (comma-separated): ");
		const seen = new Set<string>();
		const valid: string[] = [];
		const invalid: string[] = [];
		const duplicates: string[] = [];
		for (const rawEntry of answer.split(/[,;\s]+/)) {
			const entry = rawEntry.trim();
			if (!entry) continue;
			const email = normalizeEmail(entry);
			if (!validateEmail(email)) {
				invalid.push(entry);
			} else if (seen.has(email)) {
				duplicates.push(email);
			} else {
				seen.add(email);
				valid.push(email);
			}
		}

		if (invalid.length) console.log(`\n  Skipped (not a valid email): ${invalid.join(", ")}`);
		if (duplicates.length) console.log(`  Skipped (duplicate): ${duplicates.join(", ")}`);
		if (valid.length === 0) {
			console.log("\nNo valid emails entered. Nothing to do.\n");
			return;
		}

		// ── Existing-account check (a real account can't redeem an invite) ──
		const { prisma } = await import("@/lib/utils/server/prisma");
		const existing = await prisma.user.findMany({
			where: { email: { in: valid } },
			select: { email: true },
		});
		const hasAccount = new Set(existing.map((u) => u.email));

		// ── Confirmation ───────────────────────────────────────────────────
		const { SIGNUP_INVITE_TTL_DAYS } = await import("@/lib/utils/server/signup-invite");
		console.log("\n────────────────────────────────────────────────");
		console.log("  ⚠  PRODUCTION — this writes invites and sends real email");
		console.log("────────────────────────────────────────────────");
		console.log(`  Database : ${databaseHost(databaseUrl)}`);
		console.log(`  From     : ${from}`);
		console.log(`  Links    : ${baseUrl}`);
		console.log(`  Expires  : ${SIGNUP_INVITE_TTL_DAYS} days`);
		console.log("────────────────────────────────────────────────");
		console.log(`\nInviting ${valid.length}:`);
		valid.forEach((email, i) => {
			const warn = hasAccount.has(email) ? "   ⚠ already has an account" : "";
			console.log(`  ${String(i + 1).padStart(2)}. ${email}${warn}`);
		});

		const confirm = (await rl.question(`\nSend ${valid.length} invitation(s)? [y/N] `))
			.trim()
			.toLowerCase();
		if (confirm !== "y" && confirm !== "yes") {
			console.log("\nAborted. No invites created, no email sent.\n");
			return;
		}

		// ── Send loop ──────────────────────────────────────────────────────
		const { createSignupInvite } = await import("@/lib/utils/server/signup-invite");
		const { SIGNUP_WITH_INVITE } = await import("@/lib/const/routes");
		const { InviteEmail, INVITE_EMAIL_SUBJECT } = await import(
			"@/lib/utils/server/email/templates/InviteEmail"
		);
		const { Resend } = await import("resend");
		const resend = new Resend(process.env.RESEND_API_KEY);

		const sent: string[] = [];
		const failures: { email: string; reason: string; url?: string }[] = [];

		console.log("");
		for (const [i, email] of valid.entries()) {
			if (i > 0) await sleep(SEND_DELAY_MS);

			let rawToken: string;
			try {
				({ rawToken } = await createSignupInvite(email));
			} catch (err) {
				// Nothing was created — no link to hand out; safe to retry.
				failures.push({ email, reason: `invite not created: ${errorMessage(err)}` });
				console.log(`  ✗ ${email} — invite not created`);
				continue;
			}

			// The row EXISTS from here on. Any send failure must surface the URL.
			const url = absoluteUrl(SIGNUP_WITH_INVITE(rawToken));
			try {
				const { error } = await resend.emails.send({
					from,
					to: email,
					subject: INVITE_EMAIL_SUBJECT,
					react: InviteEmail({ url, expiresInDays: SIGNUP_INVITE_TTL_DAYS }),
				});
				if (error) throw new Error(error.message);
				sent.push(email);
				console.log(`  ✓ ${email}`);
			} catch (err) {
				failures.push({ email, reason: errorMessage(err), url });
				console.log(`  ✗ ${email} — send failed`);
			}
		}

		// ── Summary ────────────────────────────────────────────────────────
		console.log(`\nDone. ${sent.length} sent, ${failures.length} failed.`);
		const deliverable = failures.filter((f) => f.url);
		if (deliverable.length) {
			console.log("\nThese invites EXIST in the database but the email did not go out.");
			console.log("Send these links manually:\n");
			for (const f of deliverable) {
				console.log(`  ${f.email}\n    ${f.url}\n    (reason: ${f.reason})\n`);
			}
		}
		for (const f of failures.filter((x) => !x.url)) {
			console.log(`  ${f.email} — ${f.reason}`);
		}
		if (failures.length) process.exitCode = 1;
	} finally {
		rl.close();
		const { prisma } = await import("@/lib/utils/server/prisma");
		await prisma.$disconnect();
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
