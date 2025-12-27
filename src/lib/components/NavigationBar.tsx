"use client";

import Link from "next/link";
import { AboutModal } from "./AboutModal";

interface NavigationBarProps {
	userHomeLink?: string; // Pass the user home link from server component
}

export function NavigationBar({ userHomeLink }: NavigationBarProps) {
	return (
		<header className="h-[100px] w-full border-b border-rich-brown flex items-center justify-between px-6">
			{/* Left: Title */}
			<Link href="/collections" className="text-2xl font-bold hover:opacity-80 transition-opacity">
				Project Library
			</Link>

			{/* Right: Navigation icons */}
			<nav className="flex items-center gap-4">
				{/* Info icon - opens About modal */}
				<AboutModal />

				{/* Collections icon */}
				<Link
					href="/collections"
					className="p-2 hover:bg-soft-grey rounded transition-colors"
					aria-label="Collections"
				>
					{/* Layer-group icon (solid) */}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 576 512"
						className="w-6 h-6"
						fill="currentColor"
					>
						<path d="M264.5 5.2c14.9-6.9 32.1-6.9 47 0l218.6 101c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 149.8C37.4 145.8 32 137.3 32 128s5.4-17.9 13.9-21.8L264.5 5.2zM476.9 209.6l53.2 24.6c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 277.8C37.4 273.8 32 265.3 32 256s5.4-17.9 13.9-21.8l53.2-24.6 152 70.2c23.4 10.8 50.4 10.8 73.8 0l152-70.2zm-152 198.2l152-70.2 53.2 24.6c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 405.8C37.4 401.8 32 393.3 32 384s5.4-17.9 13.9-21.8l53.2-24.6 152 70.2c23.4 10.8 50.4 10.8 73.8 0z" />
					</svg>
				</Link>

				{/* User Home icon */}
				{userHomeLink ? (
					<Link
						href={userHomeLink}
						className="p-2 hover:bg-soft-grey rounded transition-colors"
						aria-label="User Home"
					>
						{/* House-user icon (solid) */}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 640 640"
							className="w-6 h-6"
							fill="currentColor"
						>
							<path d="M341.8 72.6C329.5 61.2 310.5 61.2 298.3 72.6L74.3 280.6C64.7 289.6 61.5 303.5 66.3 315.7C71.1 327.9 82.8 336 96 336L112 336L112 512C112 547.3 140.7 576 176 576L464 576C499.3 576 528 547.3 528 512L528 336L544 336C557.2 336 569 327.9 573.8 315.7C578.6 303.5 575.4 289.5 565.8 280.6L341.8 72.6zM264 320C264 289.1 289.1 264 320 264C350.9 264 376 289.1 376 320C376 350.9 350.9 376 320 376C289.1 376 264 350.9 264 320zM208 496C208 451.8 243.8 416 288 416L352 416C396.2 416 432 451.8 432 496C432 504.8 424.8 512 416 512L224 512C215.2 512 208 504.8 208 496z" />
						</svg>
					</Link>
				) : (
					<Link
						href="/login"
						className="p-2 hover:bg-soft-grey rounded transition-colors"
						aria-label="Log In"
					>
						{/* House-user icon (solid) */}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 640 640"
							className="w-6 h-6"
							fill="currentColor"
						>
							<path d="M341.8 72.6C329.5 61.2 310.5 61.2 298.3 72.6L74.3 280.6C64.7 289.6 61.5 303.5 66.3 315.7C71.1 327.9 82.8 336 96 336L112 336L112 512C112 547.3 140.7 576 176 576L464 576C499.3 576 528 547.3 528 512L528 336L544 336C557.2 336 569 327.9 573.8 315.7C578.6 303.5 575.4 289.5 565.8 280.6L341.8 72.6zM264 320C264 289.1 289.1 264 320 264C350.9 264 376 289.1 376 320C376 350.9 350.9 376 320 376C289.1 376 264 350.9 264 320zM208 496C208 451.8 243.8 416 288 416L352 416C396.2 416 432 451.8 432 496C432 504.8 424.8 512 416 512L224 512C215.2 512 208 504.8 208 496z" />
						</svg>
					</Link>
				)}
			</nav>
		</header>
	);
}

