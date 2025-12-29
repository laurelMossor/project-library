"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { AboutModal } from "./AboutModal";
import { CollectionsIcon, UserHomeIcon } from "./icons/icons";
import { LoginLogoutIcon } from "./LoginLogoutIcon";

interface NavigationIconsProps {
	userHomeLink?: string;
}

export function NavigationIcons({ userHomeLink }: NavigationIconsProps) {
	const { data: session } = useSession();
	const isLoggedIn = !!session;

	return (
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
	);
}

