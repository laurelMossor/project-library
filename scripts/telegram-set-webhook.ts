/**
 * Register (or clear) the Poster Catcher Telegram webhook. One-time after deploy.
 *
 * Usage:
 *   npm run telegram:webhook -- https://your-app.example.com
 *   npm run telegram:webhook -- --delete        # remove the webhook
 *
 * Requires (see .env / .env.development / .env.local):
 *   TELEGRAM_BOT_TOKEN      — the bot token from BotFather
 *   TELEGRAM_WEBHOOK_SECRET — the secret Telegram echoes back on every call (verified by the route)
 *
 * The deployed URL should point at /api/telegram/webhook; this script appends that path
 * if you pass a bare origin.
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

const WEBHOOK_PATH = "/api/telegram/webhook";

async function main() {
	const token = process.env.TELEGRAM_BOT_TOKEN;
	if (!token) {
		console.error("TELEGRAM_BOT_TOKEN is not set.");
		process.exit(1);
	}

	const arg = process.argv[2]?.trim();

	if (arg === "--delete") {
		const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, { method: "POST" });
		console.log("deleteWebhook:", await res.json());
		return;
	}

	if (!arg) {
		console.error("Usage: npm run telegram:webhook -- <https://your-app-url> | --delete");
		process.exit(1);
	}

	const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
	if (!secret) {
		console.error("TELEGRAM_WEBHOOK_SECRET is not set — refusing to register an unverified webhook.");
		process.exit(1);
	}

	// Accept either a bare origin or a full URL; normalize to the webhook path.
	const base = arg.replace(/\/+$/, "");
	const url = base.endsWith(WEBHOOK_PATH) ? base : `${base}${WEBHOOK_PATH}`;

	const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			url,
			secret_token: secret,
			allowed_updates: ["message", "channel_post"],
		}),
	});
	console.log("setWebhook:", await res.json());
	console.log("Registered:", url);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
