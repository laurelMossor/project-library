"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { ProfilePicture } from "@/lib/components/profile/ProfilePicture";
import { DropdownMenu, dropdownMenuStyles } from "@/lib/components/ui/DropdownMenu";
import { AddChip } from "@/lib/components/ui/AddChip";
import { MenuItem } from "./hamburger/MenuItem";
import { CardEntity } from "@/lib/types/card";
import { PUBLIC_PROFILE, SETTINGS, PAGE_NEW, EXPLORE_PAGE } from "@/lib/const/routes";
import { hasSession } from "@/lib/utils/auth-client";
import { UserHomeIcon, SettingsIcon, LogoutIcon } from "@/lib/components/icons/icons";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { formatRole } from "@/lib/const/roles";
import { useUnreadCount } from "@/lib/contexts/UnreadCountContext";
import { useNotificationCount } from "@/lib/components/notifications/NotificationContext";
import { NotificationDot } from "@/lib/components/ui/NotificationDot";
import { Session } from "next-auth";
import { IdentityMenuShell } from "./IdentityMenuShell";

const iconClass = "w-6 h-6 shrink-0";

interface IdentityMenuProps {
	session: Session | null;
}

/** One alternate identity in the "Switch to" list. */
function SwitchRow({
	entity,
	badge,
	hasActivity,
	disabled,
	onSelect,
}: {
	entity: CardEntity;
	badge: string;
	hasActivity: boolean;
	disabled: boolean;
	onSelect: () => void;
}) {
	return (
		<div
			role="button"
			tabIndex={disabled ? -1 : 0}
			aria-disabled={disabled}
			aria-label={`Switch to ${"name" in entity ? entity.name : (entity.displayName ?? entity.handle)}`}
			onClick={() => { if (!disabled) onSelect(); }}
			onKeyDown={(e) => {
				if (disabled) return;
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelect();
				}
			}}
			className={`px-3 py-1 cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-between gap-2 ${disabled ? "pointer-events-none opacity-50" : ""}`}
		>
			<div className="min-w-0 flex-1">
				<ProfileTag entity={entity} size="sm" asLink={false} variant="compact" badge={badge} />
			</div>
			{hasActivity && <NotificationDot />}
		</div>
	);
}

/**
 * The account menu: who you're acting as, what you can do as them, who else you can be, and log out.
 * Logged out, it's the "Log in or Sign up" card instead.
 */
export function IdentityMenu({ session: sessionProp }: IdentityMenuProps) {
	// The server render is the login chrome. A client refetch can come back with no user while
	// the cookie is still valid; trusting that painted "Log in" until a reload. A real logout
	// updates this prop (SessionRecheck refreshes when the session read confirms it).
	const isLoggedIn = hasSession(sessionProp);

	const { activeEntity, activePageId, activeRole, currentUser, pages, switchProfile, fetchPages, loading } = useActiveProfile();
	const { unreadData } = useUnreadCount();
	const { data: notifData } = useNotificationCount();

	// One "has something new" dot per identity, combining unread messages + activity notifications.
	const identityHasActivity = (key: "personal" | string) =>
		key === "personal"
			? unreadData.personal > 0 || notifData.personal > 0
			: (unreadData.pages[key] ?? 0) > 0 || (notifData.pages[key] ?? 0) > 0;

	const [isOpen, setIsOpen] = useState(false);

	if (!isLoggedIn) return <IdentityMenuShell />;
	if (!activeEntity) return null;

	// Badge: "Me" for the personal identity, the server role for a page. The pages list is only the
	// switcher, so a page that isn't in it yet is still badged.
	const activeBadge = activePageId ? (activeRole ? formatRole(activeRole) : undefined) : "Me";
	const isActingAsPage = activePageId !== null;

	const close = () => setIsOpen(false);
	const handleToggle = () => {
		// Lazily load pages when opening
		if (!isOpen) fetchPages();
		setIsOpen((o) => !o);
	};

	const switchablePages = pages.filter((p) => p.id !== activeEntity.id);
	const showPersonalUser = isActingAsPage && currentUser;
	const hasSwitchOptions = showPersonalUser || switchablePages.length > 0;

	const select = (pageId: string | null) => {
		switchProfile(pageId);
		close();
	};

	return (
		<DropdownMenu
			isOpen={isOpen}
			onClose={handleToggle}
			triggerClassName="cursor-pointer rounded transition-opacity hover:opacity-80"
			triggerAriaLabel="Profile menu"
			containerClassName="w-[260px]"
			trigger={
				<>
					{/* Mobile: avatar only */}
					<ProfilePicture entity={activeEntity} size="sm" asLink={false} className="sm:hidden" />
					{/* Desktop: fixed-width profile tag so layout never shifts with name length */}
					<div className="hidden sm:block w-[260px] px-3 py-1">
						<ProfileTag entity={activeEntity} size="md" asLink={false} variant="compact" badge={activeBadge} />
					</div>
				</>
			}
		>
			{/* Active identity, set apart from the alternates below */}
			<div className="px-3 pb-2 mb-1 border-b border-soft-grey">
				<p className="text-xs text-dusty-grey px-1 pb-1">Acting as</p>
				<ProfileTag entity={activeEntity} size="md" asLink={false} variant="compact" badge={activeBadge} className="w-full" />
			</div>

			<MenuItem
				icon={<UserHomeIcon className={iconClass} />}
				label="View profile"
				href={PUBLIC_PROFILE(activeEntity.handle)}
				closeMenu={close}
			/>
			<MenuItem icon={<SettingsIcon className={iconClass} />} label="Settings" href={SETTINGS} closeMenu={close} />

			{/* Alternates only exist if there's someone else to be. Scrolls so the actions above never move. */}
			{hasSwitchOptions && (
				<div className="mt-1 pt-2 border-t border-soft-grey">
					<p className="text-xs text-dusty-grey px-4 pb-1">Switch to</p>
					<div className="max-h-[240px] overflow-y-auto">
						{showPersonalUser && (
							<SwitchRow
								entity={currentUser as CardEntity}
								badge="Me"
								hasActivity={identityHasActivity("personal")}
								disabled={loading}
								onSelect={() => select(null)}
							/>
						)}
						{switchablePages.map((page) => (
							<SwitchRow
								key={page.id}
								entity={page}
								badge={formatRole(page.role)}
								hasActivity={identityHasActivity(page.id)}
								disabled={loading}
								onSelect={() => select(page.id)}
							/>
						))}
					</div>
				</div>
			)}

			<div className="px-4 py-2" onClick={close}>
				<AddChip href={PAGE_NEW}>Create a page</AddChip>
			</div>

			<div className={dropdownMenuStyles.divider} />

			<MenuItem
				icon={<LogoutIcon className={iconClass} />}
				label="Log out"
				onClick={() => signOut({ callbackUrl: EXPLORE_PAGE })}
				closeMenu={close}
			/>
		</DropdownMenu>
	);
}
