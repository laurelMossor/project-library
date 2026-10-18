"use client";

import Link from "next/link";
import { EVENT_NEW, EVENT_NEW_IN, POST_NEW, POST_NEW_IN } from "@/lib/const/routes";
import { CalendarIcon, PencilIcon } from "@/lib/components/icons/icons";
import { ModalShell } from "@/lib/components/ui/ModalShell";

/** A profile collection to start the draft in: `to` is a page id or NEW_IN_OWN_PROFILE. */
export type NewItemTarget = { to: string; name: string };

interface NewItemModalProps {
	onClose: () => void;
	/** Start the draft in this collection instead of wherever the active profile posts. */
	target?: NewItemTarget;
}

export function NewItemModal({ onClose, target }: NewItemModalProps) {
	return (
		<ModalShell title="Create New" onClose={onClose} widthClassName="max-w-md">
			<div className="space-y-4">
				<Link
					href={target ? POST_NEW_IN(target.to) : POST_NEW}
					onClick={onClose}
					className="flex items-start gap-3 w-full text-left p-4 border rounded hover:bg-gray-50 transition-colors"
				>
					<PencilIcon className="w-6 h-6 shrink-0 text-rich-brown" />
					<div>
						<h3 className="font-semibold text-lg mb-1">New Post</h3>
						<p className="text-sm text-warm-grey">
							{target
								? `Share an update, thought, or project on ${target.name}`
								: "Share an update, thought, or project with the community"}
						</p>
					</div>
				</Link>
				<Link
					href={target ? EVENT_NEW_IN(target.to) : EVENT_NEW}
					onClick={onClose}
					className="flex items-start gap-3 w-full text-left p-4 border rounded hover:bg-gray-50 transition-colors"
				>
					<CalendarIcon className="w-6 h-6 shrink-0 text-rich-brown" />
					<div>
						<h3 className="font-semibold text-lg mb-1">New Event</h3>
						<p className="text-sm text-warm-grey">
							{target
								? `Add a workshop, meetup, or gathering to ${target.name}`
								: "Create a new event for workshops, meetups, or gatherings"}
						</p>
					</div>
				</Link>
			</div>
		</ModalShell>
	);
}
