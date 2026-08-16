// ⚠️ SERVER-ONLY: Telegram Bot API client
//
// Thin fetch wrappers over the Telegram Bot HTTP API — no SDK. Used by the Poster
// Catcher webhook to pull a forwarded photo and reply to the sender. All calls need
// TELEGRAM_BOT_TOKEN; when it's unset the helpers no-op/throw so intake fails loudly
// in prod but local dev without a token doesn't crash.
//
// Telegram Bot API reference: https://core.telegram.org/bots/api

import { timingSafeEqual } from "node:crypto";

const API_BASE = "https://api.telegram.org";

function botToken(): string | null {
	return process.env.TELEGRAM_BOT_TOKEN || null;
}

/** Constant-time comparison of the webhook secret header against TELEGRAM_WEBHOOK_SECRET. */
export function verifyWebhookSecret(headerValue: string | null): boolean {
	const secret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
	if (!secret) return process.env.NODE_ENV !== "production"; // fail-closed in prod, allow local QA
	const provided = headerValue ?? "";
	const a = Buffer.from(provided);
	const b = Buffer.from(secret);
	return a.length === b.length && timingSafeEqual(a, b);
}

/** Is this Telegram sender id on the allowlist (TELEGRAM_ALLOWED_SENDER_IDS, comma-separated)? */
export function isAllowedSender(telegramId: string | number | null | undefined): boolean {
	if (telegramId == null) return false;
	const allowed = new Set(
		(process.env.TELEGRAM_ALLOWED_SENDER_IDS ?? "")
			.split(",")
			.map((id) => id.trim())
			.filter(Boolean),
	);
	// Empty allowlist = deny everyone (fail-closed); intake is a private tool.
	if (allowed.size === 0) return false;
	return allowed.has(String(telegramId));
}

// Minimal shape of the Telegram message fields we consume. See https://core.telegram.org/bots/api#message
export type PhotoSize = { file_id: string; width: number; height: number };
export type MessageEntity = { type: string; offset: number; length: number; url?: string };
export type TelegramMessage = {
	message_id: number;
	from?: { id: number };
	chat?: { id: number };
	text?: string;
	caption?: string;
	entities?: MessageEntity[];
	caption_entities?: MessageEntity[];
	photo?: PhotoSize[];
};

/** Pull the caption/text, first URL, and largest-photo file_id out of a Telegram message. */
export function parseTelegramMessage(msg: TelegramMessage): {
	caption: string | null;
	sourceUrl: string | null;
	photoFileId: string | null;
} {
	const text = msg.caption ?? msg.text ?? null;
	const entities = msg.caption_entities ?? msg.entities ?? [];

	// Prefer a real link entity (text_link carries its own url); fall back to a `url` entity
	// substring, then a plain regex over the text for links pasted without formatting.
	let sourceUrl: string | null = null;
	for (const e of entities) {
		if (e.type === "text_link" && e.url) {
			sourceUrl = e.url;
			break;
		}
		if (e.type === "url" && text) {
			sourceUrl = text.substring(e.offset, e.offset + e.length);
			break;
		}
	}
	if (!sourceUrl && text) {
		const match = text.match(/https?:\/\/[^\s]+/i);
		if (match) sourceUrl = match[0];
	}

	// Telegram sends photo sizes ascending; the last is the largest.
	const photoFileId = msg.photo && msg.photo.length > 0 ? msg.photo[msg.photo.length - 1].file_id : null;

	return { caption: text, sourceUrl, photoFileId };
}

type TelegramFile = { file_id: string; file_path?: string; file_size?: number };

/** Resolve a `file_id` to a downloadable `file_path` via getFile. Returns null on failure. */
export async function getFile(fileId: string): Promise<TelegramFile | null> {
	const token = botToken();
	if (!token) return null;
	try {
		const res = await fetch(`${API_BASE}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
		if (!res.ok) return null;
		const json = (await res.json()) as { ok: boolean; result?: TelegramFile };
		return json.ok && json.result ? json.result : null;
	} catch (err) {
		console.error("[telegram] getFile failed:", err);
		return null;
	}
}

/** Download the bytes for a resolved `file_path`. Returns the buffer + content type, or null. */
export async function downloadFile(
	filePath: string,
): Promise<{ buffer: Buffer; contentType: string; extension: string } | null> {
	const token = botToken();
	if (!token) return null;
	try {
		const res = await fetch(`${API_BASE}/file/bot${token}/${filePath}`);
		if (!res.ok) return null;
		const buffer = Buffer.from(await res.arrayBuffer());
		const contentType = res.headers.get("content-type") || "image/jpeg";
		const extension = filePath.split(".").pop()?.toLowerCase() || "jpg";
		return { buffer, contentType, extension };
	} catch (err) {
		console.error("[telegram] downloadFile failed:", err);
		return null;
	}
}

/** Convenience: resolve a photo `file_id` and download its bytes in one call. */
export async function fetchPhotoBytes(
	fileId: string,
): Promise<{ buffer: Buffer; contentType: string; extension: string } | null> {
	const file = await getFile(fileId);
	if (!file?.file_path) return null;
	return downloadFile(file.file_path);
}

/** Send a text reply to a chat. Best-effort — logs and swallows errors (never blocks intake). */
export async function sendMessage(chatId: string | number, text: string): Promise<void> {
	const token = botToken();
	if (!token) {
		console.warn("[telegram] sendMessage skipped — TELEGRAM_BOT_TOKEN unset");
		return;
	}
	try {
		await fetch(`${API_BASE}/bot${token}/sendMessage`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
		});
	} catch (err) {
		console.error("[telegram] sendMessage failed:", err);
	}
}
