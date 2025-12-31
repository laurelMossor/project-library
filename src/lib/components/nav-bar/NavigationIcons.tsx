"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AboutModal } from "../AboutModal";
import { AboutIcon, CollectionsIcon, UserHomeIcon } from "../icons/icons";
import { LoginLogoutIcon } from "./LoginLogoutIcon";
import { Tooltip } from "../tooltip/Tooltip";
import { getPathDisplayName } from "@/lib/utils/text";
import { useIsMobile } from "@/lib/hooks/useDeviceType";

interface NavigationIconsProps {
	userHomeLink?: string;
}

const navIconButtonStyles = "p-2 hover:opacity-80 rounded transition-colors";

export function NavigationIcons({ userHomeLink }: NavigationIconsProps) {
	const { data: session } = useSession();
	const isLoggedIn = !!session;
	const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
	const isMobile = useIsMobile();
	const navIconStyles = isMobile ? "w-5 h-5" : "w-6 h-6";

	return (
		<nav className="flex items-center gap-4">
			{/* Info icon - opens About modal */}
			<Tooltip text="About">
				<button
					onClick={() => setIsAboutModalOpen(true)}
					className={navIconButtonStyles}
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
					className={navIconButtonStyles}
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
						className={navIconButtonStyles}
						aria-label="User Home"
					>
						<UserHomeIcon className={navIconStyles} />
					</Link>
				</Tooltip>
			)}

			<Tooltip text={isLoggedIn ? "Log Out" : "Log In"}>
				<LoginLogoutIcon isLoggedIn={isLoggedIn} iconButtonStyles={navIconButtonStyles} iconStyles={navIconStyles} />
			</Tooltip>
		</nav>
	);
}



