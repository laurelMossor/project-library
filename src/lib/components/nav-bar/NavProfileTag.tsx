"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { DropdownMenu } from "@/lib/components/ui/DropdownMenu";
import { MenuItem } from "./hamburger/MenuItem";
import { CardEntity, CardUser, CardPage, isCardPage } from "@/lib/types/card";
import { PUBLIC_USER_PAGE, PUBLIC_PAGE } from "@/lib/const/routes";
import { hasSession } from "@/lib/utils/auth-client";
import { UserHomeIcon, AtSignIcon } from "@/lib/components/icons/icons";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { useUnreadCount } from "@/lib/contexts/UnreadCountContext";
import { NotificationDot } from "@/lib/components/ui/NotificationDot";
import { Session } from "next-auth";
import { NavProfileShell } from "./NavProfileShell";

interface NavProfileTagProps {
	session: Session | null;
}

export function NavProfileTag({ session: sessionProp }: NavProfileTagProps) {
	const { data: session } = useSession();
	const activeSession = session || sessionProp;
	const isLoggedIn = hasSession(activeSession);

	const { activeEntity, activePageId, currentUser, pages, switchProfile, fetchPages, loading } = useActiveProfile();
	const { unreadData } = useUnreadCount();

	const [isOpen, setIsOpen] = useState(false);
	const [switcherExpanded, setSwitcherExpanded] = useState(false);

	// Load pages on mount so the trigger badge can show the active role
	useEffect(() => {
		if (isLoggedIn) fetchPages();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isLoggedIn]);

	if (!isLoggedIn) return <NavProfileShell />;
	if (!activeEntity) return null;

	// Badge on the trigger: "me" for personal identity, role for a page
	const activeBadge = activePageId
		? (pages.find((p) => p.id === activePageId)?.role?.toLowerCase() ?? undefined)
		: "me";

	const isActingAsPage = isCardPage(activeEntity);
	const profileLink = isActingAsPage
		? PUBLIC_PAGE((activeEntity as CardPage).slug)
		: PUBLIC_USER_PAGE((activeEntity as CardUser).username);

	const handleToggle = () => {
		if (!isOpen) {
			// Lazily load pages when opening
			fetchPages();
		} else {
			// Reset expanded state when closing
			setSwitcherExpanded(false);
		}
		setIsOpen((o) => !o);
	};

	const handleSwitcherClick = () => {
		// fetchPages already called on dropdown open, but call again if expanding
		if (!switcherExpanded) fetchPages();
		setSwitcherExpanded((o) => !o);
	};

	const switchablePages = pages.filter((p) => p.id !== activeEntity.id);
	const showPersonalUser = isActingAsPage && currentUser;
	const hasSwitchOptions = showPersonalUser || switchablePages.length > 0;

	return (
		<DropdownMenu
			isOpen={isOpen}
			onClose={handleToggle}
			triggerClassName="cursor-pointer rounded transition-opacity hover:opacity-80"
			triggerAriaLabel="Profile menu"
			containerClassName="w-[260px]"
			trigger={
				<ProfileTag entity={activeEntity} size="md" asLink={false} variant="compact" badge={activeBadge} className="border-none bg-transparent hover:bg-transparent" />
			}
		>
			<MenuItem
				icon={<UserHomeIcon className="w-6 h-6 shrink-0" />}
				label="View Profile"
				href={profileLink}
				closeMenu={() => setIsOpen(false)}
			/>

			{/* "Switch Profile" expands inline to show available identities */}
			<MenuItem
				icon={<AtSignIcon className="w-6 h-6 shrink-0" />}
				label="Switch Profile"
				onClick={handleSwitcherClick}
				closeMenu={() => {/* keep menu open */}}
			/>

			{switcherExpanded && (
				<div className="pb-1">
					{/* Personal user identity (only shown when acting as a page) */}
					{showPersonalUser && (
						<div
							onClick={() => { switchProfile(null); setIsOpen(false); setSwitcherExpanded(false); }}
							className={`px-3 py-1 cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-between ${loading ? "pointer-events-none opacity-50" : ""}`}
							role="button"
							aria-label="Switch to personal profile"
						>
							<ProfileTag entity={currentUser as CardEntity} size="sm" asLink={false} variant="compact" />
							{unreadData.personal > 0 && <NotificationDot />}
						</div>
					)}

					{/* Other pages the user can act as */}
					{switchablePages.map((page) => (
						<div
							key={page.id}
							onClick={() => { switchProfile(page.id); setIsOpen(false); setSwitcherExpanded(false); }}
							className={`px-3 py-1 cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-between ${loading ? "pointer-events-none opacity-50" : ""}`}
							role="button"
							aria-label={`Switch to ${page.name}`}
						>
							<ProfileTag entity={page} size="sm" asLink={false} variant="compact" badge={page.role.toLowerCase()} />
							{(unreadData.pages[page.id] ?? 0) > 0 && <NotificationDot />}
						</div>
					))}

					{!hasSwitchOptions && (
						<p className="px-4 py-2 text-xs text-dusty-grey">No other profiles</p>
					)}
				</div>
			)}
		</DropdownMenu>
	);
}
