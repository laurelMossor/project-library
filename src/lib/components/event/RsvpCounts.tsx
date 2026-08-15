"use client";

import { useState, useEffect } from "react";
import { fetchRsvpCounts } from "@/lib/utils/event-client";
import type { RsvpCountSummary } from "@/lib/types/rsvp";

type RsvpCountsProps = {
	eventId: string;
	/** Incremented to trigger a refetch (e.g., after an RSVP submission) */
	refreshKey?: number;
};

export function RsvpCounts({ eventId, refreshKey = 0 }: RsvpCountsProps) {
	const [counts, setCounts] = useState<RsvpCountSummary | null>(null);

	useEffect(() => {
		fetchRsvpCounts(eventId)
			.then(setCounts)
			.catch(() => {
				// Silently fail — counts are supplementary info
			});
	}, [eventId, refreshKey]);

	if (!counts || counts.total === 0) return null;

	const parts: string[] = [];
	if (counts.goingTotal > 0) {
		const goingLabel =
			counts.guests > 0
				? `${counts.goingTotal} going (incl. ${counts.guests} guest${counts.guests === 1 ? "" : "s"})`
				: `${counts.goingTotal} going`;
		parts.push(goingLabel);
	}
	if (counts.maybe > 0) parts.push(`${counts.maybe} maybe`);

	return (
		<p className="text-sm font-medium text-moss-green">
			{parts.join(" · ")}
		</p>
	);
}
