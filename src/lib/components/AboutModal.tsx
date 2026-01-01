"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { COLLECTIONS, MESSAGES, PUBLIC_USER_PAGE } from "@/lib/const/routes";
import { fetchProfile } from "@/lib/utils/user-client";

const WELCOME_MESSAGE = `The Project Library is about process, not polish. This is a shared space for making, learning, and helping each other along the way. 

It's a place to share what you're working on, see what others are learning, and connect through shared interests. 

You can browse by topic or location, follow what's unfolding, and choose how you explore: no hidden algorithms. If you're working on something, or thinking about starting, you're in the right place.`;

interface AboutModalProps {
	isOpen: boolean;
	onClose: () => void;
	username: string | undefined;
}

export function AboutModal({ isOpen, onClose, username }: AboutModalProps) {
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
					<h2 className="text-2xl font-bold">About</h2>
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
					<div>
						<p className="text-sm text-warm-grey whitespace-pre-line">
							{WELCOME_MESSAGE}
						</p>
					</div>

					<div>
						<h3 className="font-semibold mb-2">Navigation</h3>
						<nav className="flex flex-col gap-2">
							<Link href={COLLECTIONS} className="text-whale-blue hover:underline">
								Collections
							</Link>
							{username && (
								<Link href={PUBLIC_USER_PAGE(username)} className="text-whale-blue hover:underline">
									Your Profile
								</Link>
							)}
							<Link href={MESSAGES} className="text-whale-blue hover:underline">
								Messages
							</Link>
						</nav>
					</div>
				</div>
			</div>
		</div>
	);
}

