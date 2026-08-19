import { EVENT_DETAIL } from "@/lib/const/routes";
import { formatDateTime, formatInstantAbsolute } from "@/lib/utils/datetime";

type PopupEvent = {
	id: string;
	title: string | null;
	eventDateTime: Date | string;
	eventTimezone: string | null;
};

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/** Leaflet popup HTML for a map pin. Escapes title, href, and date before interpolating. */
export function eventPopupHtml(event: PopupEvent): string {
	const title = escapeHtml(event.title || "Untitled Event");
	const href = escapeHtml(EVENT_DETAIL(event.id));
	const when = escapeHtml(
		event.eventTimezone
			? formatDateTime(event.eventDateTime, event.eventTimezone)
			: formatInstantAbsolute(event.eventDateTime)
	);
	return (
		`<a href="${href}" style="font-weight:600;color:var(--color-rich-brown)">${title}</a>` +
		`<div style="margin-top:4px;font-size:12px;color:var(--color-dusty-grey)">${when}</div>`
	);
}
