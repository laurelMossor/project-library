"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
	HamburgerIcon,
	CollectionsIcon,
	MessageIcon,
	PencilIcon,
	LoginIcon,
	LogoutIcon,
	SettingsIcon,
} from "../../icons/icons";
import { NotificationDot } from "../../ui/NotificationDot";
import { AboutModal } from "../../AboutModal";
import { NewItemModal } from "../NewItemModal";
import {
	MESSAGES,
	USER_PROFILE_SETTINGS,
	PAGE_PROFILE_SETTINGS,
	LOGIN_WITH_CALLBACK,
	EXPLORE_PAGE,
} from "@/lib/const/routes";
import { API_ME_PAGE, API_MESSAGES_UNREAD_COUNT } from "@/lib/const/routes";
import { hasSession } from "@/lib/utils/auth-client";
import { MenuItem } from "./MenuItem";
import { DropdownMenu, dropdownMenuStyles } from "../../ui/DropdownMenu";


interface HamburgerMenuProps {
	session: ReturnType<typeof useSession>["data"] | null;
}

const iconClass = "w-6 h-6 shrink-0";

export function HamburgerMenu({ session: sessionProp }: HamburgerMenuProps) {
	const { data: session } = useSession();
	const router = useRouter();
	const activeSession = session || sessionProp;
	const isLoggedIn = hasSession(activeSession);

	const [isOpen, setIsOpen] = useState(false);
	const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
	const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
	const [settingsLink, setSettingsLink] = useState<string | undefined>(undefined);
	const [username, setUsername] = useState<string>('');
	const [unreadCount, setUnreadCount] = useState(0);

	useEffect(() => {
		if (isLoggedIn) {
			const activePageId = activeSession?.user?.activePageId;
			if (activePageId) {
				fetch(API_ME_PAGE)
					.then((res) => (res.ok ? res.json() : null))
					.then((data) => {
						if (data?.slug) {
							setSettingsLink(PAGE_PROFILE_SETTINGS);
						}
					})
					.catch(() => {});

				fetch("/api/me/user")
					.then((r) => (r.ok ? r.json() : null))
					.then((user) => user?.username && setUsername(user.username))
					.catch(() => {});
			} else {
				fetch("/api/me/user")
					.then((r) => (r.ok ? r.json() : null))
					.then((user) => {
						if (user?.username) {
							setSettingsLink(USER_PROFILE_SETTINGS);
							setUsername(user.username);
						}
					})
					.catch(() => {});
			}
		} else {
			setSettingsLink(undefined);
		}
	}, [isLoggedIn, activeSession?.user?.activePageId]);

	// Poll for unread message count every 60 seconds when logged in
	useEffect(() => {
		if (!isLoggedIn) return;

		function fetchUnreadCount() {
			fetch(API_MESSAGES_UNREAD_COUNT)
				.then((r) => (r.ok ? r.json() : null))
				.then((data) => { if (data?.count !== undefined) setUnreadCount(data.count); })
				.catch(() => {});
		}

		fetchUnreadCount();
		const intervalId = setInterval(() => {
			if (document.visibilityState === "visible") fetchUnreadCount();
		}, 60000);
		return () => clearInterval(intervalId);
	}, [isLoggedIn]);

	const closeMenu = () => {
		setIsOpen(false);
	};

	const handleCreateNew = () => {
		closeMenu();
		if (isLoggedIn) {
			setIsNewItemModalOpen(true);
		} else {
			router.push(LOGIN_WITH_CALLBACK(typeof window !== "undefined" ? window.location.pathname : EXPLORE_PAGE));
		}
	};

	const handleMessages = () => {
		closeMenu();
		if (!isLoggedIn) {
			router.push(LOGIN_WITH_CALLBACK(MESSAGES));
		}
	};

	const handleSettings = () => {
		closeMenu();
		if (!isLoggedIn || !settingsLink) {
			router.push(LOGIN_WITH_CALLBACK(USER_PROFILE_SETTINGS));
		}
	};

	const handleLogout = async () => {
		closeMenu();
		await signOut({ callbackUrl: EXPLORE_PAGE });
	};

	const handleLogin = () => {
		closeMenu();
		router.push(LOGIN_WITH_CALLBACK(EXPLORE_PAGE));
	};


	return (
		<nav className="relative flex items-center">
			<DropdownMenu
				isOpen={isOpen}
				onClose={() => setIsOpen((o) => !o)}
				trigger={
				<div className="relative">
					<HamburgerIcon className="w-8 h-8 shrink-0" />
					{unreadCount > 0 && (
						<span className="absolute -top-0.5 -right-0.5">
							<NotificationDot />
						</span>
					)}
				</div>
			}
				triggerAriaLabel="Menu"
			>
				<MenuItem
					icon={<CollectionsIcon className={iconClass} />}
					label="Explore"
					href={EXPLORE_PAGE}
					closeMenu={closeMenu}
				/>

				<MenuItem
					icon={<PencilIcon className={iconClass} />}
					label="Post"
					onClick={handleCreateNew}
					closeMenu={closeMenu}
				/>

				<MenuItem
					icon={<MessageIcon className={iconClass} />}
					label="Messages"
					href={isLoggedIn ? MESSAGES : undefined}
					onClick={!isLoggedIn ? handleMessages : undefined}
					closeMenu={closeMenu}
					indicator={unreadCount > 0 ? <NotificationDot /> : undefined}
				/>

				<MenuItem
					icon={<SettingsIcon className={iconClass} />}
					label="Settings"
					href={settingsLink}
					onClick={!settingsLink ? handleSettings : undefined}
					closeMenu={closeMenu}
				/>

				<div className={dropdownMenuStyles.divider} />

				{isLoggedIn ? (
					<MenuItem
						icon={<LogoutIcon className={iconClass} />}
						label="Log Out"
						onClick={handleLogout}
						closeMenu={closeMenu}
					/>
				) : (
					<MenuItem
						icon={<LoginIcon className={iconClass} />}
						label="Log In"
						onClick={handleLogin}
						closeMenu={closeMenu}
					/>
				)}
			</DropdownMenu>
			{/* About modal not in use right now */}
			<AboutModal
				isOpen={isAboutModalOpen}
				onClose={() => setIsAboutModalOpen(false)}
				username={username}
			/>
			<NewItemModal
				isOpen={isNewItemModalOpen}
				onClose={() => setIsNewItemModalOpen(false)}
			/>
		</nav>
	);
}
