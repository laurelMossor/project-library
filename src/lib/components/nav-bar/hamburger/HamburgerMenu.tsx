"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
	HamburgerIcon,
	CollectionsIcon,
	MessageIcon,
	PencilIcon,
	LoginIcon,
	LogoutIcon,
	SettingsIcon,
	SearchIcon,
} from "../../icons/icons";
import { NotificationDot } from "../../ui/NotificationDot";
import { NewItemModal } from "../NewItemModal";
import {
	MESSAGES,
	SETTINGS,
	LOGIN_WITH_CALLBACK,
	EXPLORE_PAGE,
	SEARCH,
} from "@/lib/const/routes";
import { useUnreadCount } from "@/lib/contexts/UnreadCountContext";
import { hasSession } from "@/lib/utils/auth-client";
import { Session } from "next-auth";
import { MenuItem } from "./MenuItem";
import { DropdownMenu, dropdownMenuStyles } from "../../ui/DropdownMenu";


interface HamburgerMenuProps {
	session: Session | null;
}

const iconClass = "w-6 h-6 shrink-0";

export function HamburgerMenu({ session: sessionProp }: HamburgerMenuProps) {
	const router = useRouter();
	// Same rule as NavProfileTag: the server session decides Log In vs Log Out.
	const isLoggedIn = hasSession(sessionProp);

	const { activeCount: unreadCount } = useUnreadCount();

	const [isOpen, setIsOpen] = useState(false);
	const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
	const settingsLink = isLoggedIn ? SETTINGS : undefined;

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
			router.push(LOGIN_WITH_CALLBACK(EXPLORE_PAGE));
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
							<NotificationDot label="Unread messages" />
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
					icon={<SearchIcon className={iconClass} />}
					label="Profile search"
					href={SEARCH}
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
			{isNewItemModalOpen && (
				<NewItemModal onClose={() => setIsNewItemModalOpen(false)} />
			)}
		</nav>
	);
}
