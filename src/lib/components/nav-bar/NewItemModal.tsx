"use client";

import Link from "next/link";
import { EVENT_NEW, POST_NEW } from "@/lib/const/routes";
import { CalendarIcon, PencilIcon } from "@/lib/components/icons/icons";
import { ModalShell } from "@/lib/components/ui/ModalShell";

interface NewItemModalProps {
	onClose: () => void;
}

export function NewItemModal({ onClose }: NewItemModalProps) {
	return (
		<ModalShell title="Create New" onClose={onClose} widthClassName="max-w-md">
			<div className="space-y-4">
				<Link
					href={POST_NEW}
					onClick={onClose}
					className="flex items-start gap-3 w-full text-left p-4 border rounded hover:bg-gray-50 transition-colors"
				>
					<PencilIcon className="w-6 h-6 shrink-0 text-rich-brown" />
					<div>
						<h3 className="font-semibold text-lg mb-1">New Post</h3>
						<p className="text-sm text-warm-grey">Share an update, thought, or project with the community</p>
					</div>
				</Link>
				<Link
					href={EVENT_NEW}
					onClick={onClose}
					className="flex items-start gap-3 w-full text-left p-4 border rounded hover:bg-gray-50 transition-colors"
				>
					<CalendarIcon className="w-6 h-6 shrink-0 text-rich-brown" />
					<div>
						<h3 className="font-semibold text-lg mb-1">New Event</h3>
						<p className="text-sm text-warm-grey">Create a new event for workshops, meetups, or gatherings</p>
					</div>
				</Link>
			</div>
		</ModalShell>
	);
}
