"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteEvent } from "@/lib/utils/event-client";
import { COLLECTIONS } from "@/lib/const/routes";

type Props = {
	eventId: string;
	eventTitle: string;
};

export function DeleteEventButton({ eventId, eventTitle }: Props) {
	const router = useRouter();
	const [isDeleting, setIsDeleting] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const [error, setError] = useState("");

	const handleDelete = async () => {
		setIsDeleting(true);
		setError("");

		try {
			await deleteEvent(eventId);
			router.push(COLLECTIONS);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete event");
			setIsDeleting(false);
			setShowConfirm(false);
		}
	};

	if (showConfirm) {
		return (
			<div className="flex flex-col gap-2">
				<p className="text-sm text-gray-700">Are you sure you want to delete '{eventTitle}'?</p>
				{error && <p className="text-sm text-red-600">{error}</p>}
				<div className="flex gap-2">
					<button
						onClick={handleDelete}
						disabled={isDeleting}
						className="rounded border border-red-600 bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
					>
						{isDeleting ? "Deleting..." : "Delete"}
					</button>
					<button
						onClick={() => {
							setShowConfirm(false);
							setError("");
						}}
						disabled={isDeleting}
						className="rounded border border-gray-400 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-black hover:text-black disabled:opacity-50"
					>
						Cancel
					</button>
				</div>
			</div>
		);
	}

	return (
		<button
			onClick={() => setShowConfirm(true)}
			className="rounded border border-red-600 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
		>
			Delete Event
		</button>
	);
}

