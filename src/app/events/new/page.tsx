"use client";

import { createEventAction } from "@/lib/actions/event";
import { CreateDraftRedirect } from "@/lib/components/layout/CreateDraftRedirect";
import { EVENT_DETAIL } from "@/lib/const/routes";
import type { DraftPlacement } from "@/lib/utils/draft-placement";

const createDraftEvent = (input: DraftPlacement) => createEventAction({ ...input, isDraft: true });

/**
 * /events/new — Creates a draft event and redirects to the event page for inline editing.
 * The event page IS the creation surface.
 */
export default function NewEventPage() {
	return <CreateDraftRedirect create={createDraftEvent} detailHref={EVENT_DETAIL} noun="event" />;
}
