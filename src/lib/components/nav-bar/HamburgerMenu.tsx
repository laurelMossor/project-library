"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
	HamburgerIcon,
	AboutIcon,
	CollectionsIcon,
	UserHomeIcon,
	MessageIcon,
	PencilIcon,
	LoginIcon,
	LogoutIcon,
} from "../icons/icons";
import { AboutModal } from "../AboutModal";
import { NewItemModal } from "./NewItemModal";
import {
	COLLECTIONS,
	MESSAGES,
	PUBLIC_USER_PAGE,
	PUBLIC_ORG_PAGE,
	LOGIN_WITH_CALLBACK,
} from "@/lib/const/routes";
import { API_ME_OWNER } from "@/lib/const/routes";
import { hasSession } from "@/lib/utils/auth-client";

const iconClass = "w-6 h-6 shrink-0";

interface HamburgerMenuProps {
	session: ReturnType<typeof useSession>["data"] | null;
}

export function HamburgerMenu({ session: sessionProp }: HamburgerMenuProps) {
	const { data: session } = useSession();
	const router = useRouter();
	const activeSession = session || sessionProp;
	const isLoggedIn = hasSession(activeSession);

	const [isOpen, setIsOpen] = useState(false);
	const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
	const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
	const [profileLink, setProfileLink] = useState<string | undefined>(undefined);
	const [profileLabel, setProfileLabel] = useState<string>("Profile");
	const [username, setUsername] = useState<string | undefined>(undefined);

	useEffect(() => {
		if (isLoggedIn) {
			fetch(API_ME_OWNER)
				.then((res) => (res.ok ? res.json() : null))
				.then((data) => {
					if (data?.type === "ORG") {
						setProfileLink(PUBLIC_ORG_PAGE(data.data.slug));
						setProfileLabel(`${data.data.name} Profile`);
						fetch("/api/me/user")
							.then((r) => (r.ok ? r.json() : null))
							.then((user) => user?.username && setUsername(user.username))
							.catch(() => {});
					} else if (data?.type === "USER") {
						setProfileLink(PUBLIC_USER_PAGE(data.data.username));
						setProfileLabel("Profile");
						setUsername(data.data.username);
					} else {
						fetch("/api/me/user")
							.then((r) => (r.ok ? r.json() : null))
							.then((user) => {
								if (user?.username) {
									setProfileLink(PUBLIC_USER_PAGE(user.username));
									setProfileLabel("Profile");
									setUsername(user.username);
								}
							})
							.catch(() => {});
					}
				})
				.catch(() => {});
		} else {
			setProfileLink(undefined);
			setUsername(undefined);
		}
	}, [isLoggedIn, activeSession?.user?.activeOwnerId]);

	const closeMenu = () => setIsOpen(false);

	const handleAbout = () => {
		closeMenu();
		setIsAboutModalOpen(true);
	};

	const handleCreateNew = () => {
		closeMenu();
		if (isLoggedIn) {
			setIsNewItemModalOpen(true);
		} else {
			router.push(LOGIN_WITH_CALLBACK(typeof window !== "undefined" ? window.location.pathname : COLLECTIONS));
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
			router.push(LOGIN_WITH_CALLBACK(COLLECTIONS));
		}
	};

	const handleLogout = async () => {
		closeMenu();
		await signOut({ callbackUrl: COLLECTIONS });
	};

	const handleLogin = () => {
		closeMenu();
		router.push(LOGIN_WITH_CALLBACK(COLLECTIONS));
	};

	const linkClass =
		"flex items-center gap-3 w-full px-4 py-3 text-left text-rich-brown hover:bg-soft-grey rounded transition-colors";

	return (
		<nav className="relative flex items-center">
			<button
				onClick={() => setIsOpen((o) => !o)}
				className="p-2 hover:opacity-80 rounded transition-opacity"
				aria-label="Menu"
				aria-expanded={isOpen}
			>
				<HamburgerIcon className={iconClass} />
			</button>

			{isOpen && (
				<>
					<div
						className="fixed inset-0 z-40"
						aria-hidden="true"
						onClick={closeMenu}
					/>
					<div
						className="fixed right-6 top-[100px] z-50 min-w-[220px] rounded-lg border border-rich-brown bg-grey-white shadow-lg py-2"
						role="menu"
					>
						{/* About - always visible */}
						<button
							onClick={handleAbout}
							className={linkClass}
							role="menuitem"
						>
							<AboutIcon className={iconClass} />
							<span>About</span>
						</button>

						{/* Collections - always visible */}
						<Link
							href={COLLECTIONS}
							onClick={closeMenu}
							className={linkClass}
							role="menuitem"
						>
							<CollectionsIcon className={iconClass} />
							<span>Collections</span>
						</Link>

						{/* Create New - always visible; session decides navigate vs modal */}
						<button
							onClick={handleCreateNew}
							className={linkClass}
							role="menuitem"
						>
							<PencilIcon className={iconClass} />
							<span>Create New</span>
						</button>

						{/* Messages - always visible; session decides navigate vs login callback */}
						{isLoggedIn ? (
							<Link
								href={MESSAGES}
								onClick={closeMenu}
								className={linkClass}
								role="menuitem"
							>
								<MessageIcon className={iconClass} />
								<span>Messages</span>
							</Link>
						) : (
							<button
								onClick={handleMessages}
								className={linkClass}
								role="menuitem"
							>
								<MessageIcon className={iconClass} />
								<span>Messages</span>
							</button>
						)}

						{/* Profile - always visible; session decides link vs login callback */}
						{profileLink ? (
							<Link
								href={profileLink}
								onClick={closeMenu}
								className={linkClass}
								role="menuitem"
							>
								<UserHomeIcon className={iconClass} />
								<span>{profileLabel}</span>
							</Link>
						) : isLoggedIn ? (
							<Link
								href={COLLECTIONS}
								onClick={closeMenu}
								className={linkClass}
								role="menuitem"
							>
								<UserHomeIcon className={iconClass} />
								<span>Profile</span>
							</Link>
						) : (
							<button
								onClick={handleProfile}
								className={linkClass}
								role="menuitem"
							>
								<UserHomeIcon className={iconClass} />
								<span>Profile</span>
							</button>
						)}

						<div className="my-1 border-t border-soft-grey" />

						{/* Log In / Log Out - always visible */}
						{isLoggedIn ? (
							<button
								onClick={handleLogout}
								className={linkClass}
								role="menuitem"
							>
								<LogoutIcon className={iconClass} />
								<span>Log Out</span>
							</button>
						) : (
							<button
								onClick={handleLogin}
								className={linkClass}
								role="menuitem"
							>
								<LoginIcon className={iconClass} />
								<span>Log In</span>
							</button>
						)}
					</div>
				</>
			)}

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
