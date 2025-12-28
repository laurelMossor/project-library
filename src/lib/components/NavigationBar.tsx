"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { AboutModal } from "./AboutModal";
import { CollectionsIcon, UserHomeIcon } from "./icons/icons";
import { LoginLogoutIcon } from "./LoginLogoutIcon";

interface NavigationBarProps {
	userHomeLink?: string; // Pass the user home link from server component
}

export function NavigationBar({ userHomeLink }: NavigationBarProps) {
	const { data: session } = useSession();
	const isLoggedIn = !!session;

	return (
		<header className="h-[100px] w-full border-b border-rich-brown flex items-center justify-between px-6">
			{/* Left: Logo */}
			<Link href="/collections" className="hover:opacity-80 transition-opacity flex items-center">
				<Image
					src="/assets/img/Project_Library_Animated_Logo.gif"
					alt="Project Library"
					width={240}
					height={120}
					className="h-[80px] w-auto"
					unoptimized
				/>
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

