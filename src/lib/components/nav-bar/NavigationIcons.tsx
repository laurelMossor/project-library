"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AboutModal } from "../AboutModal";
import { AboutIcon, CollectionsIcon, UserHomeIcon } from "../icons/icons";
import { LoginLogoutIcon } from "./LoginLogoutIcon";

interface NavigationIconsProps {
	userHomeLink?: string;
}
const navIconStyles = "w-5 h-5";
export function NavigationIcons({ userHomeLink }: NavigationIconsProps) {
	const { data: session } = useSession();
	const isLoggedIn = !!session;
	const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

	return (
		<nav className="flex items-center gap-4">
			{/* Info icon - opens About modal */}
			<button
				onClick={() => setIsAboutModalOpen(true)}
				className="p-2 hover:bg-soft-grey rounded transition-colors"
				aria-label="About"
			>
				<AboutIcon className={navIconStyles} />
			</button>
			<AboutModal isOpen={isAboutModalOpen} onClose={() => setIsAboutModalOpen(false)} />

			{/* Collections icon */}
			<Link
				href="/collections"
				className="p-2 hover:bg-soft-grey rounded transition-colors"
				aria-label="Collections"
			>
				<CollectionsIcon className={navIconStyles} />
			</Link>

			{/* User Home icon - only show when logged in */}
			{isLoggedIn && userHomeLink && (
				<Link
					href={userHomeLink}
					className="p-2 hover:bg-soft-grey rounded transition-colors"
					aria-label="User Home"
				>
					<UserHomeIcon className={navIconStyles} />
				</Link>
			)}

			<LoginLogoutIcon isLoggedIn={isLoggedIn} className={navIconStyles} />
		</nav>
	);
}



