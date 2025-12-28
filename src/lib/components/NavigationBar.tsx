"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { AboutModal } from "./AboutModal";
import { CollectionsIcon, UserHomeIcon } from "./icons";
import { LoginLogoutIcon } from "./LoginLogoutIcon";

interface NavigationBarProps {
	userHomeLink?: string; // Pass the user home link from server component
}

export function NavigationBar({ userHomeLink }: NavigationBarProps) {
	const { data: session } = useSession();
	const isLoggedIn = !!session;

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
					<CollectionsIcon />
				</Link>

				{/* User Home icon - only show when logged in */}
				{isLoggedIn && userHomeLink && (
					<Link
						href={userHomeLink}
						className="p-2 hover:bg-soft-grey rounded transition-colors"
						aria-label="User Home"
					>
						<UserHomeIcon />
					</Link>
				)}

				<LoginLogoutIcon isLoggedIn={isLoggedIn} />
			</nav>
		</header>
	);
}

