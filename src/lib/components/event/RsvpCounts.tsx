import type { RsvpCountSummary } from "@/lib/types/rsvp";

export function RsvpCounts({ counts }: { counts: RsvpCountSummary }) {
	if (counts.total === 0) return null;

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
