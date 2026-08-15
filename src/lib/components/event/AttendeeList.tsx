"use client";

import { useState, useEffect } from "react";
import { fetchRsvps } from "@/lib/utils/event-client";
import { LocalDate } from "@/lib/components/ui/LocalDate";
import { RsvpIdentityChip } from "@/lib/components/event/RsvpIdentityChip";
import type { RsvpItem } from "@/lib/types/rsvp";

type AttendeeListProps = {
	eventId: string;
};

const STATUS_LABELS: Record<string, string> = {
	GOING: "Going",
	MAYBE: "Maybe",
	CANT_MAKE_IT: "Can't make it",
};

function StatusBadge({ status }: { status: string }) {
	return (
		<span
			className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
				status === "GOING"
					? "bg-melon-green/30 text-moss-green"
					: status === "MAYBE"
					? "bg-alice-blue text-whale-blue"
					: "bg-gray-100 text-gray-600"
			}`}
		>
			{STATUS_LABELS[status] || status}
		</span>
	);
}

export function AttendeeList({ eventId }: AttendeeListProps) {
	const [rsvps, setRsvps] = useState<RsvpItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		fetchRsvps(eventId)
			.then((data) => {
				setRsvps(data);
				setLoading(false);
			})
			.catch((err) => {
				setError(err instanceof Error ? err.message : "Failed to load attendees");
				setLoading(false);
			});
	}, [eventId]);

	if (loading) {
		return <p className="text-sm text-gray-500">Loading attendees...</p>;
	}

	if (error) {
		return <p className="text-sm text-alert-red">{error}</p>;
	}

	if (rsvps.length === 0) {
		return (
			<div className="rounded-xl border border-gray-200 p-6">
				<h3 className="text-lg font-semibold text-rich-brown mb-2">Attendees</h3>
				<p className="text-sm text-gray-500">No RSVPs yet.</p>
			</div>
		);
	}

	const headcount = rsvps.reduce(
		(sum, r) => sum + 1 + (r.status === "GOING" ? r.guests.length : 0),
		0,
	);

	return (
		<div className="rounded-xl border border-gray-200 p-6 space-y-4">
			<h3 className="text-lg font-semibold text-rich-brown">
				Attendees ({headcount})
			</h3>

			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-gray-200">
							<th className="text-left py-2 pr-4 font-medium text-gray-500">Name</th>
							<th className="text-left py-2 pr-4 font-medium text-gray-500">Email</th>
							<th className="text-left py-2 pr-4 font-medium text-gray-500">Status</th>
							<th className="text-left py-2 font-medium text-gray-500">Date</th>
						</tr>
					</thead>
					<tbody>
						{rsvps.map((rsvp) => (
							<AttendeeRows key={rsvp.id} rsvp={rsvp} />
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function AttendeeRows({ rsvp }: { rsvp: RsvpItem }) {
	const plusOne = rsvp.status === "GOING" ? rsvp.guests[0] : undefined;

	return (
		<>
			<tr className="border-b border-gray-100">
				<td className="py-2 pr-4">
					{rsvp.user ? (
						<RsvpIdentityChip user={rsvp.user} />
					) : (
						rsvp.name
					)}
				</td>
				<td className="py-2 pr-4 text-gray-600">{rsvp.email}</td>
				<td className="py-2 pr-4">
					<StatusBadge status={rsvp.status} />
				</td>
				<td className="py-2 text-gray-500">
					<LocalDate value={rsvp.createdAt} mode="absolute" />
				</td>
			</tr>
			{plusOne && (
				<tr className="border-b border-gray-50 bg-gray-50/50">
					<td className="py-1.5 pr-4 pl-8 text-gray-600">
						+1{plusOne.name ? `: ${plusOne.name}` : ""}
					</td>
					<td className="py-1.5 pr-4 text-gray-400">—</td>
					<td className="py-1.5 pr-4" />
					<td className="py-1.5" />
				</tr>
			)}
		</>
	);
}
