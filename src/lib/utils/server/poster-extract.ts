// ⚠️ SERVER-ONLY: Poster Catcher extraction
//
// Runs as post-response work (Next.js `after()`) from the Telegram webhook, so intake
// stays fast. Reduces a capture (poster image + caption + best-effort link text) to
// structured event fields via one multimodal LLM call through the Vercel AI Gateway,
// then sets the submission status per the validity contract (date is the hard gate).

import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "./prisma";
import { sendMessage } from "./telegram";
import { withSourceLine } from "../text";
import { parseFutureEventDate } from "../event-date";

// Vision-capable model, routed through the Vercel AI Gateway (AI_GATEWAY_API_KEY).
const MODEL = process.env.POSTER_CATCHER_MODEL || "openai/gpt-4o-mini";

// Extraction output. Everything nullable — the model returns what it can find; the
// caller decides status. Tags capped at 3 per the PRD (1–3 inferred tags).
const extractionSchema = z.object({
	title: z.string().nullable().describe("A concise event title, or null if none is discernible."),
	content: z
		.string()
		.nullable()
		.describe("A short event description in plain prose. Do NOT include the source link — it is added separately."),
	eventDate: z
		.string()
		.nullable()
		.describe(
			"ISO 8601 datetime (with offset if known) of the FIRST occurrence. Resolve relative dates against the capture date. Null if no date is discernible.",
		),
	eventTimezone: z.string().nullable().describe("IANA timezone (e.g. America/Los_Angeles) if determinable, else null."),
	location: z.string().nullable().describe("Venue or address if present, else null."),
	tags: z.array(z.string()).max(3).describe("1–3 short, sensible topic tags inferred from the event."),
});

export type ExtractionResult = z.infer<typeof extractionSchema>;

/** Best-effort fetch of a public link's text. Login-walled sources fail quietly (caption is the fallback). */
async function fetchLinkText(url: string): Promise<string | null> {
	try {
		const res = await fetch(url, {
			headers: { "user-agent": "Mozilla/5.0 (compatible; ProjectLibraryBot/1.0)" },
			signal: AbortSignal.timeout(8000),
		});
		if (!res.ok) return null;
		const html = await res.text();
		// Crude tag strip — enough to feed the model context, not a parser.
		const text = html
			.replace(/<script[\s\S]*?<\/script>/gi, " ")
			.replace(/<style[\s\S]*?<\/style>/gi, " ")
			.replace(/<[^>]+>/g, " ")
			.replace(/\s+/g, " ")
			.trim();
		return text.slice(0, 4000) || null;
	} catch {
		return null;
	}
}

/** Is the image URL absolute (fetchable by the hosted model)? Dev's relative /uploads/ paths aren't. */
function isAbsoluteUrl(url: string | null | undefined): url is string {
	return !!url && /^https?:\/\//i.test(url);
}

/**
 * Extract structured event fields for a captured submission and persist the outcome.
 * Idempotent-ish: always overwrites the extracted fields + status. Safe to re-run.
 */
export async function extractSubmission(submissionId: string): Promise<void> {
	const submission = await prisma.eventSubmission.findUnique({
		where: { id: submissionId },
		include: { rawImage: { select: { url: true } } },
	});
	if (!submission) return;

	const reply = (text: string) => sendMessage(submission.submitterTelegramId, text);

	// Guard: no gateway key → don't throw, mark NEEDS_FIX so the operator can hand-fill.
	if (!process.env.AI_GATEWAY_API_KEY) {
		await prisma.eventSubmission.update({
			where: { id: submissionId },
			data: {
				status: "NEEDS_FIX",
				errorNote: "AI extraction unavailable (no gateway key) — fill fields manually in review.",
			},
		});
		await reply("Saved to review. Automatic extraction is off, so add the details manually.");
		return;
	}

	try {
		const linkText = submission.sourceUrl ? await fetchLinkText(submission.sourceUrl) : null;
		const captureContext = [
			`Capture date (use to resolve relative dates like "this Friday"): ${submission.submittedAt.toISOString()}`,
			submission.sourceUrl ? `Source link: ${submission.sourceUrl}` : null,
			submission.rawCaption ? `Forwarded caption:\n${submission.rawCaption}` : null,
			linkText ? `Fetched page text (best-effort):\n${linkText}` : null,
		]
			.filter(Boolean)
			.join("\n\n");

		// Multimodal user content: the poster image (when fetchable) + all gathered text.
		const userContent: Array<{ type: "text"; text: string } | { type: "image"; image: URL }> = [
			{
				type: "text",
				text:
					"Extract the community event described by the following poster and/or text. " +
					"For recurring events, use the first upcoming occurrence. Return null for anything you cannot determine.\n\n" +
					captureContext,
			},
		];
		if (isAbsoluteUrl(submission.rawImage?.url)) {
			userContent.push({ type: "image", image: new URL(submission.rawImage.url) });
		}

		const { object } = await generateObject({
			model: MODEL,
			schema: extractionSchema,
			system:
				"You are an assistant that extracts structured event data from event posters, captions, and web pages. " +
				"Be faithful to the source; never invent a date. Write the description as plain prose without links.",
			messages: [{ role: "user", content: userContent }],
		});

		const { date, isFuture } = parseFutureEventDate(object.eventDate);
		// Bake the source link into the editable content so the operator can see/confirm it.
		const content = withSourceLine(object.content, submission.sourceUrl);

		const status = isFuture ? "READY" : "NEEDS_FIX";
		const errorNote = isFuture
			? null
			: date
				? "Extracted date is in the past — add a valid future date to publish."
				: "No event date found — add one to publish.";

		await prisma.eventSubmission.update({
			where: { id: submissionId },
			data: {
				status,
				title: object.title,
				content: content || null,
				eventDate: isFuture ? date : null,
				eventTimezone: object.eventTimezone,
				location: object.location,
				tags: object.tags ?? [],
				errorNote,
			},
		});

		if (status === "READY") {
			const when = date ? date.toDateString() : "";
			await reply(`Got it — *${object.title ?? "Untitled event"}${when ? `, ${when}` : ""}* ✅ Added to review.`);
		} else {
			await reply(`⚠️ ${errorNote} Added to review.`);
		}
	} catch (err) {
		console.error("[poster-extract] extraction failed:", err);
		await prisma.eventSubmission.update({
			where: { id: submissionId },
			data: {
				status: "FAILED",
				errorNote: err instanceof Error ? err.message : "Extraction failed.",
			},
		});
		await reply("⚠️ Couldn't read that one — added to review with the raw input.");
	}
}
