"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AboutModal } from "../AboutModal";
import { AboutIcon, CollectionsIcon, UserHomeIcon } from "../icons/icons";
import { LoginLogoutIcon } from "./LoginLogoutIcon";
import { Tooltip } from "../tooltip/Tooltip";
import { useIsMobile } from "@/lib/hooks/useDeviceType";
import { COLLECTIONS, PUBLIC_USER_PAGE, PUBLIC_ORG_PAGE, PRIVATE_USER_PAGE, PRIVATE_ORG_PAGE } from "@/lib/const/routes";
import { hasSession } from "@/lib/utils/auth-client";
import { API_ME_ACTOR } from "@/lib/const/routes";

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
	const isMobile = useIsMobile();
	const navIconStyles = isMobile ? "w-5 h-5" : "w-6 h-6";

	useEffect(() => {
		if (isLoggedIn) {
			// Fetch active actor to determine which profile to link to
			fetch(API_ME_ACTOR)
				.then((res) => {
					if (res.ok) {
						return res.json();
					}
					return null;
				})
				.then((data) => {
					if (data && data.type === "ORG") {
						// Link to org's public profile
						setProfileLink(PUBLIC_ORG_PAGE(data.data.slug));
						setProfileTooltip(`${data.data.name} Profile`);
						// Still get username for AboutModal (fetch user profile)
						fetch("/api/me/user")
							.then((res) => res.ok ? res.json() : null)
							.then((user) => {
								if (user?.username) {
									setUsername(user.username);
								}
							})
							.catch(() => {});
					} else if (data && data.type === "USER") {
						// Link to user's public profile
						setProfileLink(PUBLIC_USER_PAGE(data.data.username));
						setProfileTooltip("Profile Page");
						setUsername(data.data.username);
					} else {
						// Fallback: try to get user profile
						fetch("/api/me/user")
							.then((res) => {
								if (res.ok) {
									return res.json();
								}
								return null;
							})
							.then((user) => {
								if (user?.username) {
									setProfileLink(PUBLIC_USER_PAGE(user.username));
									setProfileTooltip("Profile Page");
									setUsername(user.username);
								}
							})
							.catch(() => {
								// Silently fail
							});
					}
				})
				.catch(() => {
					// Silently fail - profile link won't show
				});
		} else {
			setProfileLink(undefined);
			setUsername(undefined);
		}
	}, [isLoggedIn, activeSession?.user?.activeOrgId]);

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

			{/* Profile icon - links to active actor's profile (user or org) */}
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



