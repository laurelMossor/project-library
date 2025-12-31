"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AboutModal } from "../AboutModal";
import { AboutIcon, CollectionsIcon, UserHomeIcon } from "../icons/icons";
import { LoginLogoutIcon } from "./LoginLogoutIcon";
import { Tooltip } from "../tooltip/Tooltip";
import { getPathDisplayName } from "@/lib/utils/text";

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
			<Tooltip text="About">
				<button
					onClick={() => setIsAboutModalOpen(true)}
					className="p-2 hover:bg-soft-grey rounded transition-colors"
					aria-label="About"
				>
					<AboutIcon className={navIconStyles} />
				</button>
			</Tooltip>
			<AboutModal isOpen={isAboutModalOpen} onClose={() => setIsAboutModalOpen(false)} />

			{/* Collections icon */}
			<Tooltip text={"Collections"}>
				<Link
					href="/collections"
					className="p-2 hover:bg-soft-grey rounded transition-colors"
					aria-label="Collections"
				>
					<CollectionsIcon className={navIconStyles} />
				</Link>
			</Tooltip>

			{/* User Home icon - only show when logged in */}
			{isLoggedIn && userHomeLink && (
				<Tooltip text={"Profile Page"}>
					<Link
						href={userHomeLink}
						className="p-2 hover:bg-soft-grey rounded transition-colors"
						aria-label="User Home"
					>
						<UserHomeIcon className={navIconStyles} />
					</Link>
				</Tooltip>
			)}

			<Tooltip text={isLoggedIn ? "Log Out" : "Log In"}>
				<LoginLogoutIcon isLoggedIn={isLoggedIn} className={navIconStyles} />
			</Tooltip>
		</nav>
	);
}



