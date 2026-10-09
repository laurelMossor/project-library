"use server";

import { authedAction, requireId } from "@/lib/utils/server/action";
import { DomainError } from "@/lib/utils/server/domain-error";
import { createEvent, removeEvent, updateEvent } from "@/lib/utils/server/event";
import { viewerContextFor } from "@/lib/utils/server/visibility";
import type { EventCreateData, EventUpdateData } from "@/lib/types/event";

/** Create an event (a lenient draft, or a full published event). Returns its id. */
export const createEventAction = authedAction(
	async (ctx, input: EventCreateData): Promise<string> => {
		if (!input || typeof input !== "object") throw new DomainError("Invalid event");
		return createEvent(ctx.userId, input);
	},
	// The caller navigates to (or continues from) the new event; nothing on screen to refresh.
	{ refresh: false },
);

/** Edit, publish, re-place, or pin an event. */
export const updateEventAction = authedAction(
	async (ctx, input: { id: string; data: EventUpdateData }) => {
		if (!input?.data || typeof input.data !== "object") throw new DomainError("Invalid event update");
		await updateEvent(await viewerContextFor(ctx.userId), requireId(input.id, "event"), input.data);
	},
);

/**
 * Delete an event (author, or a manager of the page it lives on). No refresh: the caller
 * navigates away, and refreshing the deleted event's own page would render a 404 first.
 */
export const deleteEventAction = authedAction(
	async (ctx, input: { id: string }) => {
		await removeEvent(await viewerContextFor(ctx.userId), requireId(input?.id, "event"));
	},
	{ refresh: false },
);
