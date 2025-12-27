"use client";

import { useState } from "react";
import Link from "next/link";

export function AboutModal() {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<>
			<button
				onClick={() => setIsOpen(true)}
				className="p-2 hover:bg-soft-grey rounded transition-colors"
				aria-label="About"
			>
				{/* Info icon - circle-question (regular) */}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 512 512"
					className="w-6 h-6"
					fill="currentColor"
				>
					<path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM169.8 165.3c7.9-22.3 29.1-37.3 52.8-37.3h58.3c34.9 0 63.1 28.3 63.1 63.1c0 22.6-12.1 43.5-31.7 54.8L280 264.4c-.2 13-10.9 23.6-24 23.6c-13.3 0-24-10.7-24-24V250.5c0-8.6 4.6-16.5 12.1-20.8l44.3-25.4c4.7-2.7 7.6-7.7 7.6-13.1c0-8.4-6.8-15.1-15.1-15.1H222.6c-3.4 0-6.4 2.1-7.5 5.3l-.4 1.2c-4.4 12.5-18.2 19-30.6 14.6s-19-18.2-14.6-30.6l.4-1.2zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z" />
				</svg>
			</button>

			{isOpen && (
				<div
					className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
					onClick={() => setIsOpen(false)}
				>
					<div
						className="bg-grey-white rounded-lg p-8 max-w-md w-full mx-4"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex justify-between items-center mb-6">
							<h2 className="text-2xl font-bold">About Project Library</h2>
							<button
								onClick={() => setIsOpen(false)}
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
								<h3 className="font-semibold mb-2">Mission</h3>
								<p className="text-sm text-warm-grey">
									Project Library is about connection and sharing: Teaching—Learning—Creating Community. This website facilitates sharing and building of expertise and craft.
								</p>
							</div>

							<div>
								<h3 className="font-semibold mb-2">Navigation</h3>
								<nav className="flex flex-col gap-2">
									<Link href="/collections" className="text-whale-blue hover:underline">
										Collections
									</Link>
									<Link href="/profile" className="text-whale-blue hover:underline">
										Your Profile
									</Link>
									<Link href="/messages" className="text-whale-blue hover:underline">
										Messages
									</Link>
								</nav>
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	);
}

