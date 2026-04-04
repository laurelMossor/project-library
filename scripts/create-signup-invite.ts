/* eslint-disable no-console */
/**
 * Create a signup invite and print the URL to share (e.g. from personal email).
 *
 * Usage: npm run invite:create -- person@example.com
 *
 * Requires DATABASE_URL (see .env / .env.development / .env.local).
 * Set NEXT_PUBLIC_APP_URL or APP_BASE_URL for production links (defaults to http://localhost:3000).
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
for (const name of [".env", ".env.development", ".env.local"] as const) {
	const p = resolve(root, name);
	if (existsSync(p)) {
		config({ path: p, override: name === ".env.local" });
	}
}

async function main() {
	const email = process.argv[2]?.trim();
	if (!email) {
		console.error("Usage: npm run invite:create -- <email>");
		process.exit(1);
	}

	const { createSignupInvite } = await import("../src/lib/utils/server/signup-invite");
	const { SIGNUP_WITH_INVITE } = await import("../src/lib/const/routes");

	const { rawToken, expiresAt } = await createSignupInvite(email);
	const base =
		process.env.APP_BASE_URL ||
		process.env.NEXT_PUBLIC_APP_URL ||
		"http://localhost:3000";
	const url = new URL(SIGNUP_WITH_INVITE(rawToken), base).toString();

	console.log("Invite created.");
	console.log("Expires:", expiresAt.toISOString());
	console.log("Share this link:");
	console.log(url);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
