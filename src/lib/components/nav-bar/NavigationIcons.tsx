"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AboutModal } from "../AboutModal";
import { AboutIcon, CollectionsIcon, UserHomeIcon } from "../icons/icons";
import { LoginLogoutIcon } from "./LoginLogoutIcon";
import { Tooltip } from "../tooltip/Tooltip";
import { useIsMobile } from "@/lib/hooks/useDeviceType";
import { COLLECTIONS, PUBLIC_USER_PAGE } from "@/lib/const/routes";
import { Session } from "next-auth";
import { hasSession } from "@/lib/utils/auth-client";
import { fetchProfile } from "@/lib/utils/user-client";

interface NavigationIconsProps {
	session: Session | null;
}

const navIconButtonStyles = "p-2 hover:opacity-80 rounded transition-colors";

export function NavigationIcons({ session }: NavigationIconsProps) {
	const isLoggedIn = hasSession(session);
	const [username, setUsername] = useState<string | undefined>(undefined);
	const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
	const isMobile = useIsMobile();
	const navIconStyles = isMobile ? "w-5 h-5" : "w-6 h-6";

	useEffect(() => {
		if (isLoggedIn) {
			fetchProfile()
				.then((user) => {
					if (user?.username) {
						setUsername(user.username);
					}
				})
				.catch(() => {
					// Silently fail if user is not authenticated
					setUsername(undefined);
				});
		} else {
			setUsername(undefined);
		}
	}, [isLoggedIn]);

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
			<AboutModal isOpen={isAboutModalOpen} onClose={() => setIsAboutModalOpen(false)} username={username} />

			{/* Collections icon */}
			<Tooltip text={"Collections"}>
				<Link
					href={COLLECTIONS}
					className={navIconButtonStyles}
					aria-label="Collections"
				>
					<CollectionsIcon className={navIconStyles} />
				</Link>
			</Tooltip>

			{/* User Home icon - only show when logged in and username is available */}
			{isLoggedIn && username && (
				<Tooltip text={"Profile Page"}>
					<Link
						href={PUBLIC_USER_PAGE(username)}
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



