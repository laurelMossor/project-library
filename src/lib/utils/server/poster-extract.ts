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
import { storeImageBytes, type ImageBytes } from "./storage";
import { createImage } from "./image-attachment";
import { withSourceLine } from "../text";
import { parseFutureEventDate } from "../event-date";

// Vision-capable model, routed through the Vercel AI Gateway (AI_GATEWAY_API_KEY).
const MODEL = process.env.POSTER_CATCHER_MODEL || "openai/gpt-4o-mini";

// Extraction output. Everything nullable — the model returns what it can find; the
// caller decides status. Tags capped at 3 per the PRD (1–3 inferred tags).
const extractionSchema = z.object({
	// `found` is the anti-hallucination gate: the model must first decide whether the material
	// actually describes a real, specific event. When false, every other field must be null.
	found: z
		.boolean()
		.describe(
			"True ONLY if the provided image/caption/page text clearly describes a specific real event. " +
				"False for login walls, generic site chrome, empty/ambiguous content, or anything you'd have to guess at.",
		),
	title: z.string().nullable().describe("The event's title, copied/summarized from the source. Null if not clearly present."),
	content: z
		.string()
		.nullable()
		.describe("A short description using ONLY facts present in the source. Do NOT include the source link — it is added separately."),
	eventDate: z
		.string()
		.nullable()
		.describe(
			"ISO 8601 datetime (with offset if known) of the FIRST occurrence, resolved against the capture date. Null if no date is clearly stated.",
		),
	eventTimezone: z.string().nullable().describe("IANA timezone (e.g. America/Los_Angeles) if determinable, else null."),
	location: z.string().nullable().describe("Venue or address if present, else null."),
	tags: z
		.array(z.string())
		.max(3)
		.describe("0–3 tags grounded in the event's ACTUAL content. Do not invent themes (e.g. don't add 'live music' unless music is mentioned)."),
});

export type ExtractionResult = z.infer<typeof extractionSchema>;

type LinkMeta = { text: string | null; ogImage: string | null };

/** Resolve a possibly-relative URL against a base; return null if it can't be parsed. */
function absolutize(url: string, base: string): string | null {
	try {
		return new URL(url, base).toString();
	} catch {
		return null;
	}
}

/** Pull an og:image / twitter:image URL out of raw HTML (order-agnostic on attribute position). */
function extractOgImage(html: string, baseUrl: string): string | null {
	const patterns = [
		/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::url)?["'][^>]+content=["']([^"']+)["']/i,
		/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::url)?["']/i,
	];
	for (const p of patterns) {
		const m = html.match(p);
		if (m?.[1]) return absolutize(m[1], baseUrl);
	}
	return null;
}

/** Best-effort fetch of a public link's text + social preview image. Login-walled sources fail quietly. */
async function fetchLinkMeta(url: string): Promise<LinkMeta> {
	try {
		const res = await fetch(url, {
			headers: { "user-agent": "Mozilla/5.0 (compatible; ProjectLibraryBot/1.0)" },
			signal: AbortSignal.timeout(8000),
		});
		if (!res.ok) return { text: null, ogImage: null };
		const html = await res.text();
		const ogImage = extractOgImage(html, url);
		// Crude tag strip — enough to feed the model context, not a parser.
		const text =
			html
				.replace(/<script[\s\S]*?<\/script>/gi, " ")
				.replace(/<style[\s\S]*?<\/style>/gi, " ")
				.replace(/<[^>]+>/g, " ")
				.replace(/\s+/g, " ")
				.trim()
				.slice(0, 4000) || null;
		return { text, ogImage };
	} catch {
		return { text: null, ogImage: null };
	}
}

/** Download a remote image into bytes for storage. Returns null on failure / non-image content. */
async function downloadImage(url: string): Promise<ImageBytes | null> {
	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
		if (!res.ok) return null;
		const contentType = res.headers.get("content-type") || "image/jpeg";
		if (!contentType.startsWith("image/")) return null;
		const buffer = Buffer.from(await res.arrayBuffer());
		if (buffer.length === 0) return null;
		const extension = (contentType.split("/")[1] || "jpg").split(";")[0];
		return { buffer, contentType, extension };
	} catch {
		return null;
	}
}

/** Is the image URL absolute (fetchable by the hosted model)? Dev's relative /uploads/ paths aren't. */
function isAbsoluteUrl(url: string | null | undefined): url is string {
	return !!url && /^https?:\/\//i.test(url);
}

/** Enough caption text beyond the bare source URL to be worth extracting from. */
function captionIsMeaningful(caption: string | null, sourceUrl: string | null): boolean {
	if (!caption) return false;
	const stripped = (sourceUrl ? caption.replaceAll(sourceUrl, "") : caption).trim();
	return stripped.length >= 15;
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
		const meta = submission.sourceUrl ? await fetchLinkMeta(submission.sourceUrl) : { text: null, ogImage: null };

		// If we have no poster yet but the link exposed a social-preview image, adopt it as the
		// poster — this is how link submissions (Eventbrite etc.) get an image. Best-effort;
		// attributed to the Poster Catcher author account so approve can attach it.
		let rawImageId = submission.rawImageId;
		let imageUrl: string | null = submission.rawImage?.url ?? null;
		const authorUserId = process.env.POSTER_CATCHER_AUTHOR_USER_ID;
		if (!rawImageId && meta.ogImage && authorUserId) {
			const bytes = await downloadImage(meta.ogImage);
			if (bytes) {
				const uploaded = await storeImageBytes(bytes, "poster-catcher");
				if (uploaded.imageUrl) {
					const image = await createImage({ url: uploaded.imageUrl, path: uploaded.path!, uploadedByUserId: authorUserId });
					rawImageId = image.id;
					imageUrl = uploaded.imageUrl;
				}
			}
		}

		const hasImage = isAbsoluteUrl(imageUrl);
		const linkUnreadable = !!submission.sourceUrl && !meta.text;

		// Anti-hallucination guard: with no readable image, no fetched page text, and a caption
		// that's basically just the URL, there is nothing to extract — bail rather than let the
		// model invent an event (the Instagram-login-wall failure mode).
		if (!hasImage && !meta.text && !captionIsMeaningful(submission.rawCaption, submission.sourceUrl)) {
			console.log("[poster-extract] no usable input", {
				submissionId,
				sourceUrl: submission.sourceUrl,
				hasImage,
				linkUnreadable,
			});
			await prisma.eventSubmission.update({
				where: { id: submissionId },
				data: {
					status: "FAILED",
					rawImageId,
					errorNote: submission.sourceUrl
						? "Couldn't read that link (it may require login). Forward the poster image or paste the event details."
						: "Nothing to extract. Forward a poster image, a public link, or a text description.",
				},
			});
			await reply("⚠️ Couldn't read that one — forward the poster image or the event details and I'll try again.");
			return;
		}

		const captureContext = [
			`Capture date (use to resolve relative dates like "this Friday"): ${submission.submittedAt.toISOString()}`,
			submission.sourceUrl ? `Source link: ${submission.sourceUrl}` : null,
			submission.rawCaption ? `Forwarded caption:\n${submission.rawCaption}` : null,
			meta.text ? `Fetched page text (best-effort):\n${meta.text}` : null,
			linkUnreadable
				? "NOTE: The link could not be read (it may require login). Do NOT infer or invent its contents; rely only on the image/caption above."
				: null,
		]
			.filter(Boolean)
			.join("\n\n");

		// Multimodal user content: the poster image (when fetchable) + all gathered text.
		const userContent: Array<{ type: "text"; text: string } | { type: "image"; image: URL }> = [
			{
				type: "text",
				text:
					"Extract the community event described by the following poster and/or text. " +
					"For recurring events, use the first upcoming occurrence.\n\n" +
					captureContext,
			},
		];
		if (hasImage) {
			userContent.push({ type: "image", image: new URL(imageUrl!) });
		}

		console.log("[poster-extract] extracting", {
			submissionId,
			hasImage,
			imageFromOgTag: !submission.rawImage && !!rawImageId,
			hasLinkText: !!meta.text,
			captionLen: submission.rawCaption?.length ?? 0,
			sourceUrl: submission.sourceUrl,
		});

		const { object } = await generateObject({
			model: MODEL,
			schema: extractionSchema,
			system:
				"You extract structured event data from event posters, captions, and web pages. " +
				"Use ONLY information explicitly present in the provided material. Never guess, infer, or invent — " +
				"not a title, date, location, or tag. If the material doesn't clearly describe a specific real event " +
				"(e.g. it's a login page, generic site chrome, or too vague), set found=false and null for everything. " +
				"Write the description as plain prose without links.",
			messages: [{ role: "user", content: userContent }],
		});

		console.log("[poster-extract] result", { submissionId, ...object });

		// Respect the model's own "no real event here" signal — don't persist invented fields.
		if (!object.found) {
			await prisma.eventSubmission.update({
				where: { id: submissionId },
				data: {
					status: "FAILED",
					rawImageId,
					errorNote: "Couldn't find a real event in that. Forward a clearer poster or the event details.",
				},
			});
			await reply("⚠️ I couldn't find a real event in that one — try a clearer poster or the details.");
			return;
		}

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
				rawImageId,
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
