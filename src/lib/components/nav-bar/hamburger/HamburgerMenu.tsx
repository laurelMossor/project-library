"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
	HamburgerIcon,
	CollectionsIcon,
	UserHomeIcon,
	MessageIcon,
	PencilIcon,
	LoginIcon,
	LogoutIcon,
	SettingsIcon,
} from "../../icons/icons";
import { AboutModal } from "../../AboutModal";
import { NewItemModal } from "../NewItemModal";
import {
	COLLECTIONS,
	MESSAGES,
	PUBLIC_USER_PAGE,
	PUBLIC_ORG_PAGE,
	PRIVATE_USER_PAGE,
	USER_PROFILE_SETTINGS,
	ORG_PROFILE_SETTINGS,
	LOGIN_WITH_CALLBACK,
	EXPLORE,
} from "@/lib/const/routes";
import { API_ME_OWNER } from "@/lib/const/routes";
import { hasSession } from "@/lib/utils/auth-client";
import { MenuItem } from "./MenuItem";


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
	const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
	const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
	const [profileLink, setProfileLink] = useState<string | undefined>(undefined);
	const [profileLabel, setProfileLabel] = useState<string>("Profile");
	const [settingsLink, setSettingsLink] = useState<string | undefined>(undefined);
	const [username, setUsername] = useState<string>('');

	useLayoutEffect(() => {
		if (!isOpen || !buttonRef.current || typeof window === "undefined") return;
		const rect = buttonRef.current.getBoundingClientRect();
		setDropdownPosition({
			top: rect.bottom + 4,
			right: window.innerWidth - rect.right,
		});
	}, [isOpen]);

	useEffect(() => {
		if (isLoggedIn) {
			fetch(API_ME_OWNER)
				.then((res) => (res.ok ? res.json() : null))
				.then((data) => {
					if (data?.type === "ORG") {
						setProfileLink(PUBLIC_ORG_PAGE(data.data.slug));
						setProfileLabel(`${data.data.name} Profile`);
						setSettingsLink(ORG_PROFILE_SETTINGS);
						fetch("/api/me/user")
							.then((r) => (r.ok ? r.json() : null))
							.then((user) => user?.username && setUsername(user.username))
							.catch(() => {});
					} else if (data?.type === "USER") {
						setProfileLink(PUBLIC_USER_PAGE(data.data.username));
						setProfileLabel("Profile");
						setSettingsLink(USER_PROFILE_SETTINGS);
						setUsername(data.data.username);
					} else {
						fetch("/api/me/user")
							.then((r) => (r.ok ? r.json() : null))
							.then((user) => {
								if (user?.username) {
									setProfileLink(PUBLIC_USER_PAGE(user.username));
									setProfileLabel("Profile");
									setSettingsLink(USER_PROFILE_SETTINGS);
									setUsername(user.username);
								}
							})
							.catch(() => {});
					}
				})
				.catch(() => {});
		} else {
			setProfileLink(undefined);
			setSettingsLink(undefined);
		}
	}, [isLoggedIn, activeSession?.user?.activeOwnerId]);

	const closeMenu = () => {
		setIsOpen(false);
		setDropdownPosition(null);
	};

	const handleAbout = () => {
		closeMenu();
		setIsAboutModalOpen(true);
	};

	const handleCreateNew = () => {
		closeMenu();
		if (isLoggedIn) {
			setIsNewItemModalOpen(true);
		} else {
			router.push(LOGIN_WITH_CALLBACK(typeof window !== "undefined" ? window.location.pathname : EXPLORE));
		}
	};

	const handleMessages = () => {
		closeMenu();
		if (!isLoggedIn) {
			router.push(LOGIN_WITH_CALLBACK(MESSAGES));
		}
	};

	const handleProfile = () => {
		closeMenu();
		if (!isLoggedIn) {
			router.push(LOGIN_WITH_CALLBACK(PRIVATE_USER_PAGE));
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
		await signOut({ callbackUrl: EXPLORE });
	};

	const handleLogin = () => {
		closeMenu();
		router.push(LOGIN_WITH_CALLBACK(EXPLORE));
	};


	return (
		<nav className="relative flex items-center">
			<button
				ref={buttonRef}
				onClick={() => setIsOpen((o) => !o)}
				className="p-2 hover:opacity-80 rounded transition-opacity"
				aria-label="Menu"
				aria-expanded={isOpen}
			>
				<HamburgerIcon className={'w-8 h-8 shrink-0'} />
			</button>

			{isOpen && (
				<>
					<div
						className="fixed inset-0 z-40"
						aria-hidden="true"
						onClick={closeMenu}
					/>
					{dropdownPosition && (
					<div
						className="z-50 min-w-[220px] rounded-lg border border-rich-brown bg-grey-white shadow-lg py-2"
						style={{
							position: "fixed",
							top: dropdownPosition.top,
							right: dropdownPosition.right,
						}}
						role="menu"
					>
						<MenuItem
							icon={<CollectionsIcon className={iconClass} />}
							label="Explore"
							href={EXPLORE}
							closeMenu={closeMenu}
						/>

						<MenuItem
							icon={<PencilIcon className={iconClass} />}
							label="Post"
							onClick={handleCreateNew}
							closeMenu={closeMenu}
						/>

						<MenuItem
							icon={<UserHomeIcon className={iconClass} />}
							label="Profile"
							href={isLoggedIn ? PUBLIC_USER_PAGE(username) : undefined}
							onClick={!isLoggedIn ? handleProfile : undefined}
							closeMenu={closeMenu}
						/>

						<MenuItem
							icon={<MessageIcon className={iconClass} />}
							label="Messages"
							href={isLoggedIn ? MESSAGES : undefined}
							onClick={!isLoggedIn ? handleMessages : undefined}
							closeMenu={closeMenu}
						/>

						<MenuItem
							icon={<SettingsIcon className={iconClass} />}
							label="Settings"
							href={settingsLink}
							onClick={!settingsLink ? handleSettings : undefined}
							closeMenu={closeMenu}
						/>

						<div className="my-1 border-t border-soft-grey" />

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
					</div>
					)}
				</>
			)}
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
