"use client";

/// DEPRECATED

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AboutModal } from "../AboutModal";
import { AboutIcon, CollectionsIcon, UserHomeIcon, MessageIcon, PencilIcon } from "../icons/icons";
import { LoginLogoutIcon } from "./LoginLogoutIcon";
import { Tooltip } from "../tooltip/Tooltip";
import { useIsMobile } from "@/lib/hooks/useDeviceType";
import { COLLECTIONS, PUBLIC_USER_PAGE, PUBLIC_PAGE, MESSAGES } from "@/lib/const/routes";
import { hasSession } from "@/lib/utils/auth-client";
import { API_ME_PAGE } from "@/lib/const/routes";
import { NewItemModal } from "./NewItemModal";

interface NavigationIconsProps {
	session: ReturnType<typeof useSession>["data"] | null;
}

const navIconButtonStyles = "p-2 hover:opacity-80 rounded transition-colors";

export function NavigationIcons({ session: sessionProp }: NavigationIconsProps) {
	const { data: session } = useSession();
	const activeSession = session || sessionProp;
	const isLoggedIn = hasSession(activeSession);
	const [profileLink, setProfileLink] = useState<string | undefined>(undefined);
	const [profileTooltip, setProfileTooltip] = useState<string>("Profile Page");
	const [username, setUsername] = useState<string | undefined>(undefined);
	const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
	const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
	const [isMobile, setIsMobile] = useState(false); // Start with false to match SSR
	const isMobileHook = useIsMobile();
	const navIconStyles = isMobile ? "w-5 h-5" : "w-6 h-6";

	// Update isMobile after mount to avoid hydration mismatch
	useEffect(() => {
		setIsMobile(isMobileHook);
	}, [isMobileHook]);

	useEffect(() => {
		if (isLoggedIn) {
			// Check if user has an active page
			const activePageId = activeSession?.user?.activePageId;
			if (activePageId) {
				// Fetch active page info
				fetch(API_ME_PAGE)
					.then((res) => res.ok ? res.json() : null)
					.then((data) => {
						if (data?.slug) {
							setProfileLink(PUBLIC_PAGE(data.slug));
							setProfileTooltip(`${data.name} Profile`);
						}
					})
					.catch(() => {});

				// Still get username
				fetch("/api/me/user")
					.then((res) => res.ok ? res.json() : null)
					.then((user) => {
						if (user?.username) {
							setUsername(user.username);
						}
					})
					.catch(() => {});
			} else {
				// Link to user's public profile
				fetch("/api/me/user")
					.then((res) => res.ok ? res.json() : null)
					.then((user) => {
						if (user?.username) {
							setProfileLink(PUBLIC_USER_PAGE(user.username));
							setProfileTooltip("Profile Page");
							setUsername(user.username);
						}
					})
					.catch(() => {});
			}
		} else {
			setProfileLink(undefined);
			setUsername(undefined);
		}
	}, [isLoggedIn, activeSession?.user?.activePageId]);

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

			{/* Pencil icon - opens modal for new event */}
			{isLoggedIn && (
				<Tooltip text="Create New">
					<button
						onClick={() => setIsNewItemModalOpen(true)}
						className={navIconButtonStyles}
						aria-label="Create New"
					>
						<PencilIcon className={navIconStyles} />
					</button>
				</Tooltip>
			)}
			<NewItemModal isOpen={isNewItemModalOpen} onClose={() => setIsNewItemModalOpen(false)} />

			{/* Message icon - links to messages panel */}
			{isLoggedIn && (
				<Tooltip text="Messages">
					<Link
						href={MESSAGES}
						className={navIconButtonStyles}
						aria-label="Messages"
					>
						<MessageIcon className={navIconStyles} />
					</Link>
				</Tooltip>
			)}

			{/* Profile icon - links to active profile (user or page) */}
			{isLoggedIn && profileLink && (
				<Tooltip text={profileTooltip}>
					<Link
						href={profileLink}
						className={navIconButtonStyles}
						aria-label="Profile"
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
