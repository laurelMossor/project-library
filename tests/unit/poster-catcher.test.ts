/**
 * Poster Catcher unit tests — the pure, security-critical seams of the ingestion pipeline:
 *   - superadmin env gate (who can open /admin/*)
 *   - Telegram webhook auth: secret-token verification + sender allowlist
 *   - capture parsing: pulling caption / link / largest photo out of a Telegram message
 *   - the date validity gate (READY vs NEEDS_FIX) shared by extraction + review
 *   - the "Original source" content line
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { isSuperAdmin } from "@/lib/utils/server/superadmin";
import { verifyWebhookSecret, isAllowedSender, parseTelegramMessage } from "@/lib/utils/server/telegram";
import { parseFutureEventDate } from "@/lib/utils/event-date";
import { withSourceLine } from "@/lib/utils/text";

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("isSuperAdmin (env allowlist)", () => {
	beforeEach(() => {
		vi.stubEnv("SUPERADMIN_USER_IDS", "u_alice, u_bob");
	});

	test("matches configured ids, trimming whitespace", () => {
		expect(isSuperAdmin("u_alice")).toBe(true);
		expect(isSuperAdmin("u_bob")).toBe(true);
	});

	test("rejects unknown, null, and undefined", () => {
		expect(isSuperAdmin("u_carol")).toBe(false);
		expect(isSuperAdmin(null)).toBe(false);
		expect(isSuperAdmin(undefined)).toBe(false);
	});

	test("empty env → nobody is superadmin", () => {
		vi.stubEnv("SUPERADMIN_USER_IDS", "");
		expect(isSuperAdmin("u_alice")).toBe(false);
	});
});

describe("verifyWebhookSecret", () => {
	test("accepts an exact match, rejects a mismatch", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "s3cret");
		expect(verifyWebhookSecret("s3cret")).toBe(true);
		expect(verifyWebhookSecret("wrong")).toBe(false);
		expect(verifyWebhookSecret(null)).toBe(false);
	});

	test("fails closed in production when the secret is unconfigured", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "");
		expect(verifyWebhookSecret("anything")).toBe(false);
	});
});

describe("isAllowedSender", () => {
	test("only allowlisted ids pass; empty allowlist denies all", () => {
		vi.stubEnv("TELEGRAM_ALLOWED_SENDER_IDS", "111, 222");
		expect(isAllowedSender(111)).toBe(true);
		expect(isAllowedSender("222")).toBe(true);
		expect(isAllowedSender(333)).toBe(false);
		expect(isAllowedSender(null)).toBe(false);

		vi.stubEnv("TELEGRAM_ALLOWED_SENDER_IDS", "");
		expect(isAllowedSender(111)).toBe(false);
	});
});

describe("parseTelegramMessage (capture)", () => {
	test("extracts caption, a text_link url, and the largest photo file_id", () => {
		const result = parseTelegramMessage({
			message_id: 1,
			caption: "Improv Jam this Friday",
			caption_entities: [{ type: "text_link", offset: 0, length: 4, url: "https://example.com/event" }],
			photo: [
				{ file_id: "small", width: 90, height: 90 },
				{ file_id: "large", width: 1280, height: 1280 },
			],
		});
		expect(result.caption).toBe("Improv Jam this Friday");
		expect(result.sourceUrl).toBe("https://example.com/event");
		expect(result.photoFileId).toBe("large");
	});

	test("falls back to a plain-text url and handles photo-only messages", () => {
		expect(parseTelegramMessage({ message_id: 2, text: "see https://foo.test/x now" }).sourceUrl).toBe(
			"https://foo.test/x",
		);
		const photoOnly = parseTelegramMessage({ message_id: 3, photo: [{ file_id: "only", width: 10, height: 10 }] });
		expect(photoOnly.photoFileId).toBe("only");
		expect(photoOnly.sourceUrl).toBeNull();
		expect(photoOnly.caption).toBeNull();
	});
});

describe("parseFutureEventDate (validity gate)", () => {
	test("future date → usable (READY)", () => {
		const iso = new Date(Date.now() + 86_400_000).toISOString();
		const { date, isFuture } = parseFutureEventDate(iso);
		expect(isFuture).toBe(true);
		expect(date).toBeInstanceOf(Date);
	});

	test("past date → not usable (NEEDS_FIX)", () => {
		expect(parseFutureEventDate(new Date(Date.now() - 86_400_000).toISOString()).isFuture).toBe(false);
	});

	test("null / invalid → not usable", () => {
		expect(parseFutureEventDate(null).isFuture).toBe(false);
		expect(parseFutureEventDate("not-a-date").isFuture).toBe(false);
		expect(parseFutureEventDate("not-a-date").date).toBeNull();
	});
});

describe("withSourceLine", () => {
	test("appends the source line to existing content", () => {
		expect(withSourceLine("Come dance", "https://x.test")).toBe("Come dance\n\nOriginal source: https://x.test");
	});

	test("is idempotent (never doubles the line)", () => {
		const once = withSourceLine("Body", "https://x.test");
		expect(withSourceLine(once, "https://x.test")).toBe(once);
	});

	test("no url → content unchanged; empty content + url → just the line", () => {
		expect(withSourceLine("Body", null)).toBe("Body");
		expect(withSourceLine("", "https://x.test")).toBe("Original source: https://x.test");
	});
});
