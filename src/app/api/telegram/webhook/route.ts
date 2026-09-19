import { NextResponse, after } from "next/server";
import {
	verifyWebhookSecret,
	isAllowedSender,
	fetchPhotoBytes,
	sendMessage,
	parseTelegramMessage,
	type TelegramMessage,
} from "@/lib/utils/server/telegram";
import { storeImageBytes } from "@/lib/utils/server/storage";
import { createImage } from "@/lib/utils/server/image-attachment";
import { createSubmission } from "@/lib/utils/server/event-submission";
import { extractSubmission } from "@/lib/utils/server/poster-extract";

// Downloads media + writes rows; never cache. Headroom for the image download.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type TelegramUpdate = { message?: TelegramMessage; channel_post?: TelegramMessage };

/**
 * POST /api/telegram/webhook — Poster Catcher intake.
 *
 * Verifies the Telegram secret header + sender allowlist, captures the forwarded
 * poster/caption/link into a PENDING EventSubmission, acknowledges fast (200 so
 * Telegram doesn't retry), then runs extraction as post-response work via after().
 */
export async function POST(request: Request) {
	// 1. Verify the shared secret Telegram echoes back on every webhook call.
	if (!verifyWebhookSecret(request.headers.get("x-telegram-bot-api-secret-token"))) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let update: TelegramUpdate;
	try {
		update = (await request.json()) as TelegramUpdate;
	} catch {
		return NextResponse.json({ ok: true }); // malformed body → ack-and-drop, no retries
	}

	const msg = update.message ?? update.channel_post;
	const senderId = msg?.from?.id;

	// 2. Sender allowlist. Ack-and-drop anything else so Telegram doesn't retry.
	if (!msg || !isAllowedSender(senderId)) {
		return NextResponse.json({ ok: true });
	}

	try {
		const { caption, sourceUrl, photoFileId } = parseTelegramMessage(msg);

		// Nothing actionable (no photo, no link, no caption) → ack-and-drop.
		if (!photoFileId && !sourceUrl && !caption) {
			return NextResponse.json({ ok: true });
		}

		// 3. Download + persist the poster image, attributed to the Poster Catcher author
		//    account (so the operator can attach it to an Event later — attach requires ownership).
		let rawImageId: string | null = null;
		let imageErrorNote: string | null = null;
		if (photoFileId) {
			const authorUserId = process.env.POSTER_CATCHER_AUTHOR_USER_ID;
			if (!authorUserId) {
				imageErrorNote = "POSTER_CATCHER_AUTHOR_USER_ID unset — poster not stored";
			} else {
				const bytes = await fetchPhotoBytes(photoFileId);
				if (bytes) {
					const uploaded = await storeImageBytes(bytes, "poster-catcher");
					if (uploaded.imageUrl) {
						const image = await createImage({
							url: uploaded.imageUrl,
							path: uploaded.path!,
							uploadedByUserId: authorUserId,
						});
						rawImageId = image.id;
					} else {
						imageErrorNote = `Poster upload failed: ${uploaded.error}`;
					}
				} else {
					imageErrorNote = "Could not download poster from Telegram";
				}
			}
		}

		// Visibility into what we captured (viewable in Vercel function logs). The image-capture
		// note is otherwise overwritten by extraction, so log it here where it's authoritative.
		console.log("[telegram] captured", {
			senderId: String(senderId),
			hasPhoto: !!photoFileId,
			storedImage: !!rawImageId,
			imageErrorNote,
			hasSourceUrl: !!sourceUrl,
			captionLen: caption?.length ?? 0,
		});

		// 4. Stage the submission (PENDING) and ack immediately.
		const submission = await createSubmission({
			submitterTelegramId: String(senderId),
			sourceUrl,
			rawCaption: caption,
			rawImageId,
			errorNote: imageErrorNote,
		});

		// 5. Extraction runs after the response is sent (keeps intake fast).
		after(async () => {
			try {
				await extractSubmission(submission.id);
			} catch (err) {
				console.error("[telegram] extractSubmission failed:", err);
			}
		});

		// Best-effort quick ack in the chat; the real result comes from extraction.
		if (msg.chat?.id) {
			after(() => sendMessage(msg.chat!.id, "Got it — extracting event details…"));
		}

		return NextResponse.json({ ok: true });
	} catch (err) {
		console.error("POST /api/telegram/webhook error:", err);
		// Still 200: a 5xx makes Telegram retry the same update repeatedly.
		return NextResponse.json({ ok: true });
	}
}
