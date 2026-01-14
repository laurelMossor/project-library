"use client";

import Link from "next/link";
import { PROJECT_NEW, EVENT_NEW } from "@/lib/const/routes";

interface NewItemModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export function NewItemModal({ isOpen, onClose }: NewItemModalProps) {
	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
			onClick={onClose}
		>
			<div
				className="bg-grey-white rounded-lg p-8 max-w-md w-full mx-4"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex justify-between items-center mb-6">
					<h2 className="text-2xl font-bold">Create New</h2>
					<button
						onClick={onClose}
						className="text-warm-grey hover:text-rich-brown"
						aria-label="Close"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 384 512"
							className="w-6 h-6"
							fill="currentColor"
						>
							<path d="M324.5 411.1c6.2 6.2 16.4 6.2 22.6 0s6.2-16.4 0-22.6L214.6 256 347.1 123.5c6.2-6.2 6.2-16.4 0-22.6s-16.4-6.2-22.6 0L192 233.4 59.5 100.9c-6.2-6.2-16.4-6.2-22.6 0s-6.2 16.4 0 22.6L169.4 256 36.9 388.5c-6.2 6.2-6.2 16.4 0 22.6s16.4 6.2 22.6 0L192 278.6 324.5 411.1z" />
						</svg>
					</button>
				</div>

				<div className="space-y-4">
					<Link
						href={PROJECT_NEW}
						onClick={onClose}
						className="block w-full text-left p-4 border rounded hover:bg-gray-50 transition-colors"
					>
						<h3 className="font-semibold text-lg mb-1">New Project</h3>
						<p className="text-sm text-warm-grey">Create a new project to share what you're working on</p>
					</Link>
					<Link
						href={EVENT_NEW}
						onClick={onClose}
						className="block w-full text-left p-4 border rounded hover:bg-gray-50 transition-colors"
					>
						<h3 className="font-semibold text-lg mb-1">New Event</h3>
						<p className="text-sm text-warm-grey">Create a new event for workshops, meetups, or gatherings</p>
					</Link>
				</div>
			</div>
		</div>
	);
}
