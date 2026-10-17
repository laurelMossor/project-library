"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
	HamburgerIcon,
	CollectionsIcon,
	MessageIcon,
	PencilIcon,
	SearchIcon,
	PeopleGroupIcon,
} from "../../icons/icons";
import { NotificationDot } from "../../ui/NotificationDot";
import { NewItemModal } from "../NewItemModal";
import {
	MESSAGES,
	CONNECTIONS,
	LOGIN_WITH_CALLBACK,
	EXPLORE_PAGE,
	SEARCH,
} from "@/lib/const/routes";
import { useUnreadCount } from "@/lib/contexts/UnreadCountContext";
import { hasSession } from "@/lib/utils/auth-client";
import { Session } from "next-auth";
import { MenuItem } from "./MenuItem";
import { DropdownMenu } from "../../ui/DropdownMenu";


interface HamburgerMenuProps {
	session: Session | null;
}

const iconClass = "w-6 h-6 shrink-0";

/**
 * The places you go: Explore, Find people, Post, Messages, Connections. Who you are and what you
 * can do as them (Settings, switching, log out) live in the IdentityMenu.
 */
export function HamburgerMenu({ session: sessionProp }: HamburgerMenuProps) {
	const router = useRouter();
	// Same rule as IdentityMenu: the server session decides what's signed in.
	const isLoggedIn = hasSession(sessionProp);

	const { activeCount: unreadCount } = useUnreadCount();

	const [isOpen, setIsOpen] = useState(false);
	const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);

	const closeMenu = () => {
		setIsOpen(false);
	};

	// Messages and Connections need an account: signed in they're plain links, signed out they go to
	// log in and come back.
	const requiresLogin = (route: string) =>
		isLoggedIn ? { href: route } : { onClick: () => router.push(LOGIN_WITH_CALLBACK(route)) };

	const handleCreateNew = () => {
		closeMenu();
		if (isLoggedIn) {
			setIsNewItemModalOpen(true);
		} else {
			router.push(LOGIN_WITH_CALLBACK(typeof window !== "undefined" ? window.location.pathname : EXPLORE_PAGE));
		}
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
				containerClassName="min-w-[280px]"
			>
				<MenuItem
					icon={<CollectionsIcon className={iconClass} />}
					label="Explore"
					caption="What's happening near you"
					href={EXPLORE_PAGE}
					closeMenu={closeMenu}
				/>

				<MenuItem
					icon={<SearchIcon className={iconClass} />}
					label="Find people"
					caption="People and pages"
					href={SEARCH}
					closeMenu={closeMenu}
				/>

				<MenuItem
					icon={<PencilIcon className={iconClass} />}
					label="Post"
					caption="Share a project or event"
					onClick={handleCreateNew}
					closeMenu={closeMenu}
				/>

				<MenuItem
					icon={<MessageIcon className={iconClass} />}
					label="Messages"
					caption="Your conversations"
					{...requiresLogin(MESSAGES)}
					closeMenu={closeMenu}
					indicator={unreadCount > 0 ? <NotificationDot /> : undefined}
				/>

				<MenuItem
					icon={<PeopleGroupIcon className={iconClass} />}
					label="Connections"
					caption="Followers, pages, and membership"
					{...requiresLogin(CONNECTIONS)}
					closeMenu={closeMenu}
				/>
			</DropdownMenu>
			{isNewItemModalOpen && (
				<NewItemModal onClose={() => setIsNewItemModalOpen(false)} />
			)}
		</nav>
	);
}
