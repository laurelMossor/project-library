// ⚠️ SERVER-ONLY: turns post/event lifecycle moments into activities for the dispatcher.
//
// The post/event counterpart to the emits in comment.ts. activity.ts stays content-agnostic; the
// rules for which posts and events count live here.

import { NotificationObject } from "@prisma/client";
import { emitActivity } from "./activity";
import { speakerRef } from "./content-placement";

type PublishedContent = {
	id: string;
	userId: string;
	pageId: string | null;
	asPageId: string | null;
	/** Posts only: set on an update to another post. */
	parentPostId?: string | null;
	/** Posts only: set on an update to an event. */
	eventId?: string | null;
};

/**
 * Tell a page's members that a post or event was just published in it. Only top-level content that
 * lives in a page counts: updates to posts and events are skipped. `authorUserId` is the human who
 * just published it (the same option comments pass): the dispatcher never notifies them of their own
 * act, which is not always the stored author when an editor publishes a page-voiced draft. Call after
 * the publishing write commits, so the dispatcher's visibility check sees it as published. Never throws.
 */
export async function notifyPageActivity(
	kind: typeof NotificationObject.POST | typeof NotificationObject.EVENT,
	content: PublishedContent,
	authorUserId: string,
): Promise<void> {
	if (!content.pageId || content.parentPostId || content.eventId) return;
	await emitActivity(
		"content.published",
		speakerRef(content.userId, content.asPageId),
		{ type: "PAGE", id: content.pageId },
		{ type: kind, id: content.id },
		{ authorUserId },
	);
}
